import assert from "node:assert/strict";
import test from "node:test";
import { validateFlight, safeBookingUrl, formatFlightTime, formatFlightDate, formatFlightPrice } from "../src/lib/flights.ts";

const leg = { origin_airport: "BCN", destination_airport: "LIS", travel_date: "2028-12-22", departureTimezone: "Europe/Madrid", arrivalTimezone: "Europe/Lisbon" };
function form(overrides = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ airline: "  Vueling  ", flightNumber: " vy123 ", originAirport: "bcn", destinationAirport: "lis",
    departureDate: "2028-12-22", departureTime: "09:30", departureTimezone: "Europe/Madrid",
    arrivalDate: "2028-12-22", arrivalTime: "10:25", arrivalTimezone: "Europe/Lisbon", price: "89", currency: "eur", bookingUrl: "https://example.test/book?q=flight", notes: "  Window seats  ", ...overrides })) result.set(key, value);
  return result;
}

test("manual proposals normalize text, convert airport-local times, and ignore forged scope/ownership", () => {
  const result = validateFlight(form({ proposer_id: "other-user", trip_id: "other-trip", trip_leg_id: "other-leg" }), leg);
  assert.equal(result.valid, true);
  assert.deepEqual(result.data, { airline: "Vueling", flight_number: "VY123", origin_airport: "BCN", destination_airport: "LIS",
    departure_at: "2028-12-22T08:30:00Z", arrival_at: "2028-12-22T10:25:00Z", departure_timezone: "Europe/Madrid", arrival_timezone: "Europe/Lisbon",
    price: 89, currency: "EUR", booking_url: "https://example.test/book?q=flight", notes: "Window seats" });
});
test("optional details remain null while zero price remains a real price", () => {
  const result = validateFlight(form({ flightNumber: "", price: "", bookingUrl: "", notes: " " }), leg);
  for (const key of ["flight_number", "price", "booking_url", "notes"]) assert.equal(result.data[key], null);
  assert.equal(validateFlight(form({ price: "0" }), leg).data.price, 0);
  assert.equal(validateFlight(form({ price: "9999999999.99" }), leg).valid, true);
});
test("bounds, real dates, route, departure date, times, and airport time zones are enforced", () => {
  for (const [key, value] of [["airline", " "], ["airline", "x".repeat(121)], ["flightNumber", "x".repeat(21)], ["notes", "x".repeat(5001)],
    ["originAirport", "LAX"], ["destinationAirport", "BER"], ["departureDate", "2028-12-23"], ["arrivalDate", "2027-02-29"], ["arrivalDate", "0000-01-01"],
    ["arrivalDate", "2028-02-30"], ["arrivalDate", "2028-2-9"], ["departureTime", "24:00"], ["arrivalTime", "9:30"], ["arrivalTime", "10:25:00"],
    ["departureTimezone", "Invented/Zone"], ["departureTimezone", "UTC"], ["arrivalTimezone", "+01:00"], ["currency", "EU"], ["currency", "1AA"],
    ["airline", new File(["name"], "name.txt")], ["notes", new File(["text"], "notes.txt")]]) {
    assert.ok(validateFlight(form({ [key]: value }), leg).fields[key], key);
  }
  for (const price of ["-1", "1.234", "1e2", "NaN", "Infinity", "10,50", "10000000000"]) assert.ok(validateFlight(form({ price }), leg).fields.price, price);
});
test("safe booking links allow absolute HTTP(S), never scripts, credentials, controls, or oversized URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "//example.test", "https://user:secret@example.test", "https://", "https://example.test/\npath", "https://example.test/a b", `https://example.test/${"x".repeat(2048)}`]) {
    assert.equal(safeBookingUrl(url), null, url);
    assert.ok(validateFlight(form({ bookingUrl: url }), leg).fields.bookingUrl);
  }
  assert.equal(safeBookingUrl("http://example.test/flight"), "http://example.test/flight");
});
test("arrival ordering compares instants across time zones, overnight trips, and the date line", () => {
  assert.ok(validateFlight(form({ arrivalTime: "08:29" }), leg).fields.arrivalTime);
  assert.ok(validateFlight(form({ arrivalTime: "08:30" }), leg).fields.arrivalTime);
  assert.equal(validateFlight(form({ arrivalDate: "2028-12-23", arrivalTime: "00:05" }), leg).valid, true);
  const westbound = { origin_airport: "HND", destination_airport: "LAX", travel_date: "2028-12-22" };
  const result = validateFlight(form({ originAirport: "HND", destinationAirport: "LAX", departureTime: "17:00", departureTimezone: "Asia/Tokyo", arrivalTime: "10:00", arrivalTimezone: "America/Los_Angeles" }), westbound);
  assert.equal(result.valid, true);
  assert.equal(result.data.departure_at, "2028-12-22T08:00:00Z");
  assert.equal(result.data.arrival_at, "2028-12-22T18:00:00Z");
});
test("clock gaps are rejected and repeated clock times require an explicit occurrence", () => {
  const spring = { origin_airport: "JFK", destination_airport: "LAX", travel_date: "2025-03-09" };
  const gap = validateFlight(form({ originAirport: "JFK", destinationAirport: "LAX", departureDate: spring.travel_date, departureTime: "02:30", departureTimezone: "America/New_York", arrivalDate: spring.travel_date, arrivalTime: "09:00", arrivalTimezone: "America/Los_Angeles" }), spring);
  assert.match(gap.fields.departureTime, /does not exist/);
  const fall = { ...spring, travel_date: "2025-11-02" };
  const repeated = { originAirport: "JFK", destinationAirport: "LAX", departureDate: fall.travel_date, departureTime: "01:30", departureTimezone: "America/New_York", arrivalDate: fall.travel_date, arrivalTime: "09:00", arrivalTimezone: "America/Los_Angeles" };
  assert.match(validateFlight(form(repeated), fall).fields.departureOccurrence, /happens twice/);
  assert.equal(validateFlight(form({ ...repeated, departureOccurrence: "earlier" }), fall).data.departure_at, "2025-11-02T05:30:00Z");
  assert.equal(validateFlight(form({ ...repeated, departureOccurrence: "later" }), fall).data.departure_at, "2025-11-02T06:30:00Z");
});
test("flight formatting uses airport dates, 24-hour clocks, and explicit currency codes", () => {
  for (const hostZone of ["America/Los_Angeles", "Asia/Tokyo"]) {
    const previous = process.env.TZ;
    try {
      process.env.TZ = hostZone;
      assert.equal(formatFlightTime("2028-12-22T23:05:00Z", "Europe/Madrid"), "00:05");
      assert.equal(formatFlightDate("2028-12-22T23:05:00Z", "Europe/Madrid"), "Dec 23, 2028");
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
  assert.equal(formatFlightPrice(0, "EUR"), "EUR 0.00");
  assert.equal(formatFlightPrice(null, "USD"), "Not provided");
});

test("extreme calendar dates cannot convert outside the supported UTC year range", () => {
  const edge = { origin_airport: "HND", destination_airport: "LAX", travel_date: "0001-01-01" };
  const result = validateFlight(form({ originAirport: "HND", destinationAirport: "LAX", departureDate: edge.travel_date,
    departureTime: "00:30", departureTimezone: "Asia/Tokyo", arrivalDate: "0001-01-02", arrivalTimezone: "America/Los_Angeles" }), edge);
  assert.match(result.fields.departureDate, /UTC value/);
});
