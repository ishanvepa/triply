import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import postgres from "postgres";

test("travel leg appends and reorders serialize without dropping changes", { timeout: 30000 }, async t => {
  const suffix = randomUUID();
  const connect = name => postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
    max: 1, onnotice: () => {}, connection: { application_name: name },
  });
  const admin = connect(`leg-admin-${suffix}`);
  const first = connect(`leg-first-${suffix}`);
  const secondName = `leg-second-${suffix}`;
  const second = connect(secondName);
  const ownerId = randomUUID();
  const tripId = randomUUID();
  let a;
  let b;
  const settle = query => query.then(value => ({ value }), error => ({ error }));
  async function begin() {
    for (const connection of [a, b]) {
      await connection`begin`;
      await connection`set local role authenticated`;
      await connection`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    }
  }
  async function waiting() {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [{ blocked }] = await admin`select exists(select 1 from pg_stat_activity
        where application_name = ${secondName} and wait_event_type = 'Lock') as blocked`;
      if (blocked) return;
      await delay(20);
    }
    assert.fail("Concurrent itinerary write did not wait for the trip lock");
  }
  const order = async () => (await admin`select id from public.trip_legs where trip_id = ${tripId} order by position`).map(row => row.id);
  try {
    await admin`insert into auth.users (id, email) values (${ownerId}, ${`leg-race-${suffix}@example.test`})`;
    await admin`insert into public.trips (id, created_by, name, start_date, end_date)
      values (${tripId}, ${ownerId}, 'Travel leg concurrency fixture', '2028-12-01', '2028-12-31')`;
    a = await first.reserve();
    b = await second.reserve();
    await t.test("two appends both commit at distinct positions", async () => {
      await begin();
      await a`select public.create_trip_leg(${tripId}, 'BCN', 'LIS', '2028-12-22')`;
      const pending = settle(b`select public.create_trip_leg(${tripId}, 'LIS', 'BER', '2028-12-24')`);
      await waiting();
      await a`commit`;
      assert.equal((await pending).error, undefined);
      await b`commit`;
      const positions = await admin`select position from public.trip_legs where trip_id = ${tripId} order by position`;
      assert.deepEqual(positions.map(row => row.position), [0, 1]);
    });
    await t.test("a stale concurrent reorder rolls back instead of overwriting", async () => {
      const before = await order();
      const moved = [...before].reverse();
      await begin();
      await a`select public.reorder_trip_legs(${tripId}, ${a.array(before)}::uuid[], ${a.array(moved)}::uuid[])`;
      const pending = settle(b`select public.reorder_trip_legs(${tripId}, ${b.array(before)}::uuid[], ${b.array(moved)}::uuid[])`);
      await waiting();
      await a`commit`;
      assert.equal((await pending).error?.code, "40001");
      await b`rollback`;
      assert.deepEqual(await order(), moved);
    });
    await t.test("an append invalidates the older reorder snapshot", async () => {
      const before = await order();
      await begin();
      await a`select public.create_trip_leg(${tripId}, 'BER', 'ATL', '2028-12-28')`;
      const pending = settle(b`select public.reorder_trip_legs(${tripId}, ${b.array(before)}::uuid[], ${b.array([...before].reverse())}::uuid[])`);
      await waiting();
      await a`commit`;
      assert.equal((await pending).error?.code, "40001");
      await b`rollback`;
      const after = await order();
      assert.equal(after.length, 3);
      assert.deepEqual(after.slice(0, 2), before);
    });
  } finally {
    for (const connection of [a, b]) {
      if (connection) { await connection`rollback`; connection.release(); }
    }
    await admin`delete from public.trips where id = ${tripId}`;
    await admin`delete from auth.users where id = ${ownerId}`;
    await Promise.all([admin.end(), first.end(), second.end()]);
  }
});
