import assert from "node:assert/strict";
import test from "node:test";
import { formatTripDates, getTripStatus } from "../src/lib/trips/format.ts";

test("trip status includes both boundary days and does not imply booking completion", () => {
  const trip = { start_date: "2026-12-22", end_date: "2027-01-02" };
  assert.equal(getTripStatus(trip, "2026-12-21").label, "Upcoming");
  assert.equal(getTripStatus(trip, "2026-12-22").label, "In progress");
  assert.equal(getTripStatus(trip, "2027-01-02").label, "In progress");
  assert.equal(getTripStatus(trip, "2027-01-03").label, "Past");
});

test("date ranges preserve calendar days, years, and single-day trips", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      assert.equal(formatTripDates("2026-12-22", "2026-12-22"), "Dec 22, 2026");
      const range = formatTripDates("2026-12-22", "2027-01-02");
      assert.match(range, /Dec 22, 2026/);
      assert.match(range, /Jan 2, 2027/);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
