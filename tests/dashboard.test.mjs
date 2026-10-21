import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDashboard, summarizeLeg } from "../src/lib/trips/dashboard.ts";

const leg = { id: "leg-a", origin_airport: "BCN", destination_airport: "LIS", travel_date: "2028-12-22", position: 0, selected_proposal_id: null };
const proposal = { id: "flight-a", trip_leg_id: leg.id };
const members = ["alex", "sam", "jordan", "taylor"];
function booking(user_id, status, overrides = {}) {
  return { trip_leg_id: leg.id, proposal_id: proposal.id, user_id, status, ...overrides };
}

test("leg statuses follow proposals, selection, and booking commitments", () => {
  assert.equal(summarizeLeg(leg, [], [], members).status.label, "Needs options");
  assert.equal(summarizeLeg(leg, [proposal], [], members).status.label, "Decision pending");
  const selected = { ...leg, selected_proposal_id: proposal.id };
  assert.equal(summarizeLeg(selected, [proposal], [], members).status.label, "Flight selected");
  assert.equal(summarizeLeg(selected, [proposal], [booking("sam", "not_decided"), booking("alex", "not_joining")], members).status.label, "Flight selected");
  for (const status of ["planning_to_book", "booked"]) {
    assert.equal(summarizeLeg(selected, [proposal], [booking("sam", status)], members).status.label, "Booking underway");
  }
});

test("booking progress excludes opt-outs and counts missing reports as not booked", () => {
  const selected = { ...leg, selected_proposal_id: proposal.id };
  const result = summarizeLeg(selected, [proposal], [booking("alex", "booked"), booking("sam", "not_joining"), booking("jordan", "planning_to_book")], members);
  assert.equal(result.booked, 1);
  assert.equal(result.participating, 3);
  assert.equal(result.notJoining, 1);
  const noParticipants = summarizeLeg(selected, [proposal], members.map(id => booking(id, "not_joining")), members);
  assert.equal(noParticipants.participating, 0);
  assert.equal(noParticipants.booked, 0);
});

test("only current members and the selected proposal contribute to booking progress", () => {
  const reports = [booking("outsider", "booked"), booking("alex", "booked", { proposal_id: "old-selection" }), booking("sam", "booked", { trip_leg_id: "other-leg" })];
  const selected = summarizeLeg({ ...leg, selected_proposal_id: proposal.id }, [proposal], reports, members);
  assert.equal(selected.booked, 0);
  assert.equal(selected.status.label, "Flight selected");
  const unselected = summarizeLeg(leg, [proposal], [booking("alex", "booked")], members);
  assert.equal(unselected.booked, 0);
  assert.equal(unselected.participating, 0);
});

test("dashboard orders legs by position, deduplicates destinations, and sums traveler-leg bookings", () => {
  const legs = [
    { ...leg, id: "leg-c", position: 2 },
    { ...leg, id: "leg-b", origin_airport: "LIS", destination_airport: "BER", position: 1, selected_proposal_id: "flight-b" },
    { ...leg, selected_proposal_id: proposal.id },
  ];
  const before = structuredClone(legs);
  const result = summarizeDashboard(legs, [proposal, { id: "flight-b", trip_leg_id: "leg-b" }], [
    booking("alex", "booked"), booking("sam", "not_joining"),
    booking("alex", "booked", { trip_leg_id: "leg-b", proposal_id: "flight-b" }),
  ], members);
  assert.deepEqual(result.legs.map(leg => leg.id), ["leg-a", "leg-b", "leg-c"]);
  assert.deepEqual(result.destinations, ["LIS", "BER"]);
  assert.equal(result.totalLegs, 3);
  assert.equal(result.selectedLegs, 2);
  assert.equal(result.booked, 2);
  assert.equal(result.participating, 7);
  assert.deepEqual(legs, before);
});

test("empty trips have zero progress and no destinations", () => {
  assert.deepEqual(summarizeDashboard([], [], [], members), {
    legs: [], destinations: [], totalLegs: 0, selectedLegs: 0, booked: 0, participating: 0,
  });
});
