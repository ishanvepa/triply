import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "../types/database.types.ts";

export type FlightValues = {
  airline: string; flightNumber: string; originAirport: string; destinationAirport: string;
  departureDate: string; departureTime: string; departureTimezone: string; departureOccurrence: string;
  arrivalDate: string; arrivalTime: string; arrivalTimezone: string; arrivalOccurrence: string;
  price: string; currency: string; bookingUrl: string; notes: string;
};
export type FlightFormState = { error?: string; fields?: Partial<Record<keyof FlightValues, string>>; values?: FlightValues };
export type FlightLeg = { origin_airport: string; destination_airport: string; travel_date: string; departureTimezone?: string; arrivalTimezone?: string };
export type FlightProposal = Database["public"]["Tables"]["flight_proposals"]["Row"] & {
  proposer: { display_name: string } | null; interest: { count: number }[];
};

export function safeBookingUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\x00-\x20\x7f]/.test(value) || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  try { return Temporal.PlainDate.from(value).toString() === value; } catch { return false; }
}

function namedTimezone(value: string) {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) return null;
  try { return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone; } catch { return null; }
}

export function validateFlight(form: FormData, leg: FlightLeg) {
  const fields: NonNullable<FlightFormState["fields"]> = {};
  function text(key: keyof FlightValues) {
    const value = form.get(key);
    if (value !== null && typeof value !== "string") fields[key] = "Enter a text value.";
    return typeof value === "string" ? value.trim() : "";
  }
  const values: FlightValues = {
    airline: text("airline"), flightNumber: text("flightNumber").toUpperCase(),
    originAirport: text("originAirport").toUpperCase(), destinationAirport: text("destinationAirport").toUpperCase(),
    departureDate: text("departureDate"), departureTime: text("departureTime"), departureTimezone: text("departureTimezone"), departureOccurrence: text("departureOccurrence"),
    arrivalDate: text("arrivalDate"), arrivalTime: text("arrivalTime"), arrivalTimezone: text("arrivalTimezone"), arrivalOccurrence: text("arrivalOccurrence"),
    price: text("price"), currency: text("currency").toUpperCase(), bookingUrl: text("bookingUrl"), notes: text("notes"),
  };
  if (!values.airline || values.airline.length > 120) fields.airline = "Enter an airline name with 1–120 characters.";
  if (values.flightNumber.length > 20) fields.flightNumber = "Keep the flight number to 20 characters or fewer.";
  for (const [key, expected] of [["originAirport", leg.origin_airport], ["destinationAirport", leg.destination_airport]] as const) {
    if (values[key] !== expected) fields[key] = `Use ${expected} for this travel leg.`;
  }
  if (values.departureDate !== leg.travel_date) fields.departureDate = "Departure must be on the travel leg's date.";
  if (values.price && (!/^\d{1,10}(?:\.\d{1,2})?$/.test(values.price) || !Number.isFinite(Number(values.price)))) {
    fields.price = "Enter a price from 0 to 9999999999.99 with up to two decimal places.";
  }
  if (!/^[A-Z]{3}$/.test(values.currency)) fields.currency = "Enter a three-letter currency code.";
  if (values.bookingUrl && !safeBookingUrl(values.bookingUrl)) fields.bookingUrl = "Enter a full HTTP or HTTPS URL without spaces or login credentials (up to 2,048 characters).";
  if (values.notes.length > 5000) fields.notes = "Keep notes to 5,000 characters or fewer.";

  function instant(side: "departure" | "arrival", expectedZone?: string) {
    const dateKey = `${side}Date` as const;
    const timeKey = `${side}Time` as const;
    const zoneKey = `${side}Timezone` as const;
    const occurrenceKey = `${side}Occurrence` as const;
    if (!calendarDate(values[dateKey])) fields[dateKey] = "Enter a valid calendar date.";
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values[timeKey])) fields[timeKey] = "Enter a 24-hour time as HH:mm.";
    const zone = namedTimezone(values[zoneKey]);
    if (!zone) fields[zoneKey] = "Enter an IANA time zone, such as Europe/Lisbon.";
    else if (expectedZone && zone !== namedTimezone(expectedZone)) fields[zoneKey] = `Use ${expectedZone} for this airport.`;
    if (!["", "earlier", "later"].includes(values[occurrenceKey])) fields[occurrenceKey] = "Choose the earlier or later occurrence.";
    if (!zone || fields[dateKey] || fields[timeKey] || fields[zoneKey] || fields[occurrenceKey]) return null;
    const plain = Temporal.PlainDateTime.from(`${values[dateKey]}T${values[timeKey]}`);
    const earlier = plain.toZonedDateTime(zone, { disambiguation: "earlier" });
    const later = plain.toZonedDateTime(zone, { disambiguation: "later" });
    if (!earlier.toPlainDateTime().equals(plain) || !later.toPlainDateTime().equals(plain)) {
      fields[timeKey] = "This local time does not exist because the clocks change. Choose another time.";
      return null;
    }
    if (earlier.epochMilliseconds !== later.epochMilliseconds && !values[occurrenceKey]) {
      fields[occurrenceKey] = "This time happens twice when clocks change. Choose the earlier or later occurrence.";
      return null;
    }
    const result = (values[occurrenceKey] === "later" ? later : earlier).toInstant();
    const utcYear = result.toZonedDateTimeISO("UTC").year;
    if (utcYear < 1 || utcYear > 9999) {
      fields[dateKey] = "Choose a date whose UTC value is within years 0001–9999.";
      return null;
    }
    return result;
  }
  const departure = instant("departure", leg.departureTimezone);
  const arrival = instant("arrival", leg.arrivalTimezone);
  if (departure && arrival && Temporal.Instant.compare(arrival, departure) <= 0) fields.arrivalTime = "Arrival must be after departure, accounting for airport time zones.";
  const valid = Object.keys(fields).length === 0 && !!departure && !!arrival;
  const data = valid ? {
    airline: values.airline, flight_number: values.flightNumber || null,
    origin_airport: leg.origin_airport, destination_airport: leg.destination_airport,
    departure_at: departure.toString(), arrival_at: arrival.toString(),
    departure_timezone: namedTimezone(values.departureTimezone)!, arrival_timezone: namedTimezone(values.arrivalTimezone)!,
    price: values.price === "" ? null : Number(values.price), currency: values.currency,
    booking_url: safeBookingUrl(values.bookingUrl), notes: values.notes || null,
  } : null;
  return { values, fields, valid, data };
}

export function formatFlightTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(value));
}
export function formatFlightDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(value));
}
export function formatFlightPrice(price: number | null, currency: string) {
  return price === null ? "Not provided" : `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)}`;
}
