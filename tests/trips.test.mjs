import assert from "node:assert/strict";
import test from "node:test";
import { formatTripDates, getTripStatus } from "../src/lib/trips/format.ts";
import { validateTrip } from "../src/lib/trips/validation.ts";

function tripForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "  Europe winter trip  ", startDate: "2028-02-29", endDate: "2028-03-02", description: "  Bring everyone along.  ", ...overrides })) {
    form.set(key, value);
  }
  return form;
}

test("creation validates real calendar dates, ordering, and single-day trips", () => {
  assert.equal(validateTrip(tripForm()).valid, true);
  assert.equal(validateTrip(tripForm({ endDate: "2028-02-29" })).valid, true);
  assert.equal(validateTrip(tripForm({ endDate: "2028-02-28" })).fields.endDate, "End date must be on or after the start date.");
  for (const date of ["", "2027-02-29", "2028-02-30", "2028-13-01", "0000-01-01", "2028-2-9", "2028-01-01T00:00:00Z", "infinity"]) {
    assert.ok(validateTrip(tripForm({ startDate: date })).fields.startDate, date);
    assert.ok(validateTrip(tripForm({ endDate: date })).fields.endDate, date);
  }
});

test("creation trims text, enforces bounds, and ignores submitted ownership", () => {
  const result = validateTrip(tripForm({ created_by: "someone-else", role: "organizer" }));
  assert.equal(result.values.name, "Europe winter trip");
  assert.equal(result.values.description, "Bring everyone along.");
  assert.deepEqual(Object.keys(result.values).sort(), ["description", "endDate", "name", "startDate"]);
  assert.equal(validateTrip(tripForm({ description: "  " })).values.description, "");
  assert.equal(validateTrip(tripForm({ name: "x".repeat(120), description: "x".repeat(5000) })).valid, true);
  for (const name of ["", "   ", "x".repeat(121), new File(["name"], "name.txt")]) assert.ok(validateTrip(tripForm({ name })).fields.name);
  assert.ok(validateTrip(tripForm({ description: "x".repeat(5001) })).fields.description);
});

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
