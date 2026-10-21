import assert from "node:assert/strict";
import test from "node:test";
import { validateTravelLeg, moveLegOrder } from "../src/lib/trips/validation.ts";

function legForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ originAirport: " bcn ", destinationAirport: " lis ", travelDate: "2028-02-29", ...overrides })) form.set(key, value);
  return form;
}

test("travel legs normalize codes, allow uncatalogued airports, and ignore scope/order fields", () => {
  const result = validateTravelLeg(legForm({ trip_id: "other-trip", position: "0", selected_proposal_id: "forged" }));
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, { originAirport: "BCN", destinationAirport: "LIS", travelDate: "2028-02-29" });
  assert.equal(validateTravelLeg(legForm({ destinationAirport: "KEF" })).valid, true);
});

test("travel legs reject non-IATA-shaped, identical, missing, and non-text airports", () => {
  for (const value of ["", " ", "BC", "BCNN", "B1N", "BÇN", "B C", new File(["BCN"], "code.txt")]) {
    assert.ok(validateTravelLeg(legForm({ originAirport: value })).fields.originAirport);
    assert.ok(validateTravelLeg(legForm({ destinationAirport: value })).fields.destinationAirport);
  }
  assert.equal(validateTravelLeg(legForm({ destinationAirport: "bcn" })).fields.destinationAirport, "Choose a different destination airport.");
});

test("travel dates validate real calendar days without imposing trip or chronological bounds", () => {
  for (const value of ["", "2027-02-29", "2028-02-30", "2028-2-9", "0000-01-01", "2028-01-01T00:00:00Z", new File(["2028-02-29"], "date.txt")]) {
    assert.ok(validateTravelLeg(legForm({ travelDate: value })).fields.travelDate);
  }
  for (const value of ["0001-01-01", "9999-12-31", "2000-02-29"]) assert.equal(validateTravelLeg(legForm({ travelDate: value })).valid, true);
});

test("up/down moves preserve identities without mutating the displayed order", () => {
  const order = ["a", "b", "c"];
  assert.deepEqual(moveLegOrder(order, "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(moveLegOrder(order, "b", "down"), ["a", "c", "b"]);
  assert.deepEqual(order, ["a", "b", "c"]);
  for (const [ids, id, direction] of [[order, "a", "up"], [order, "c", "down"], [order, "missing", "up"], [order, "b", "sideways"], [["a", "a"], "a", "down"], [[], "a", "up"]]) {
    assert.equal(moveLegOrder(ids, id, direction), null);
  }
});
