import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import postgres from "postgres";

// Deliberately local-only; these tests must never use a hosted DB credential.
const localUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connect = (name) => postgres(localUrl, {
  max: 1,
  onnotice: () => {},
  connection: { application_name: name },
});

test("database decision races", { timeout: 30000 }, async (t) => {
  const suffix = randomUUID();
  const admin = connect(`triply-admin-${suffix}`);
  const organizer = connect(`triply-organizer-${suffix}`);
  const member = connect(`triply-member-${suffix}`);
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const tripId = randomUUID();
  const legId = randomUUID();
  const firstId = randomUUID();
  const secondId = randomUUID();
  let ownerConnection;
  let memberConnection;

  async function begin() {
    await ownerConnection`begin`;
    await ownerConnection`set local role authenticated`;
    await ownerConnection`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    await memberConnection`begin`;
    await memberConnection`set local role authenticated`;
    await memberConnection`select set_config('request.jwt.claim.sub', ${memberId}, true)`;
  }

  async function waitForLock(name) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [{ waiting }] = await admin`
        select exists(select 1 from pg_stat_activity
          where application_name = ${name} and wait_event_type = 'Lock') as waiting`;
      if (waiting) return;
      await delay(20);
    }
    assert.fail("The second transaction did not wait for the leg lock");
  }

  // Attach the rejection handler immediately while the statement waits.
  const settle = (query) => query.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  const vote = () => memberConnection`
    insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
    values (${tripId}, ${legId}, ${firstId})`;
  const book = () => memberConnection`
    insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, status)
    values (${tripId}, ${legId}, ${firstId}, 'booked')`;
  const select = (id) => ownerConnection`
    update public.trip_legs set selected_proposal_id = ${id} where id = ${legId}`;

  try {
    await admin.begin(async (sql) => {
      await sql`insert into auth.users (id, email) values
        (${ownerId}, ${`race-owner-${suffix}@example.test`}),
        (${memberId}, ${`race-member-${suffix}@example.test`})`;
      await sql`insert into public.trips (id, name, start_date, end_date, created_by)
        values (${tripId}, 'Concurrency fixture', '2026-12-01', '2026-12-05', ${ownerId})`;
      await sql`insert into public.trip_members (trip_id, user_id) values (${tripId}, ${memberId})`;
      await sql`insert into public.trip_legs (id, trip_id, origin_airport, destination_airport, travel_date, position)
        values (${legId}, ${tripId}, 'BCN', 'LIS', '2026-12-01', 0)`;
      for (const id of [firstId, secondId]) {
        await sql`insert into public.flight_proposals (id, trip_id, trip_leg_id, proposer_id, airline,
          origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone)
          values (${id}, ${tripId}, ${legId}, ${ownerId}, 'Test flight', 'BCN', 'LIS',
            '2026-12-01 08:30+00', '2026-12-01 09:30+00', 'Europe/Madrid', 'Europe/Lisbon')`;
      }
    });
    ownerConnection = await organizer.reserve();
    memberConnection = await member.reserve();

    await t.test("selection commits before a concurrent vote", async () => {
      await begin();
      await select(firstId);
      const pending = settle(vote());
      await waitForLock(`triply-member-${suffix}`);
      await ownerConnection`commit`;
      const result = await pending;
      assert.equal(result.error?.code, "23514");
      await memberConnection`rollback`;
      const [{ count }] = await admin`select count(*)::int as count from public.flight_votes where trip_leg_id = ${legId}`;
      assert.equal(count, 0);
      await admin`update public.trip_legs set selected_proposal_id = null where id = ${legId}`;
    });

    await t.test("a vote already in progress completes before selection", async () => {
      await begin();
      await vote();
      const pending = settle(select(firstId));
      await waitForLock(`triply-organizer-${suffix}`);
      await memberConnection`commit`;
      assert.equal((await pending).error, undefined);
      await ownerConnection`commit`;
      const [{ count }] = await admin`select count(*)::int as count from public.flight_votes where trip_leg_id = ${legId}`;
      assert.equal(count, 1);
      await admin`update public.trip_legs set selected_proposal_id = null where id = ${legId}`;
      await admin`delete from public.flight_votes where trip_leg_id = ${legId}`;
    });

    await t.test("a booking prevents a concurrent selection change", async () => {
      await admin`update public.trip_legs set selected_proposal_id = ${firstId} where id = ${legId}`;
      await begin();
      await book();
      const pending = settle(select(secondId));
      await waitForLock(`triply-organizer-${suffix}`);
      await memberConnection`commit`;
      assert.equal((await pending).error?.code, "23514");
      await ownerConnection`rollback`;
      const [{ selected_proposal_id }] = await admin`select selected_proposal_id from public.trip_legs where id = ${legId}`;
      assert.equal(selected_proposal_id, firstId);
      await admin`delete from public.flight_bookings where trip_leg_id = ${legId}`;
    });

    await t.test("selection change rejects a concurrent stale booking", async () => {
      await begin();
      await select(secondId);
      const pending = settle(book());
      await waitForLock(`triply-member-${suffix}`);
      await ownerConnection`commit`;
      assert.equal((await pending).error?.code, "23514");
      await memberConnection`rollback`;
      const [{ count }] = await admin`select count(*)::int as count from public.flight_bookings where trip_leg_id = ${legId}`;
      assert.equal(count, 0);
    });
  } finally {
    // Roll back any transaction interrupted by an assertion before cleanup.
    if (ownerConnection) { await ownerConnection`rollback`; ownerConnection.release(); }
    if (memberConnection) { await memberConnection`rollback`; memberConnection.release(); }
    await admin`delete from public.trips where id = ${tripId}`;
    await admin`delete from auth.users where id in (${ownerId}, ${memberId})`;
    await Promise.all([admin.end(), organizer.end(), member.end()]);
  }
});
