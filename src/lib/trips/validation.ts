export type TripValues = { name: string; startDate: string; endDate: string; description: string };
export type TripFormState = {
  error?: string;
  fields?: Partial<Record<keyof TripValues, string>>;
  values?: TripValues;
};

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateTrip(form: FormData) {
  const values: TripValues = {
    name: text(form, "name"), startDate: text(form, "startDate"),
    endDate: text(form, "endDate"), description: text(form, "description"),
  };
  const fields: NonNullable<TripFormState["fields"]> = {};
  if (!values.name || values.name.length > 120) fields.name = "Enter a trip name with 1–120 characters.";
  if (!isCalendarDate(values.startDate)) fields.startDate = "Enter a valid start date.";
  if (!isCalendarDate(values.endDate)) fields.endDate = "Enter a valid end date.";
  if (!fields.startDate && !fields.endDate && values.endDate < values.startDate) {
    fields.endDate = "End date must be on or after the start date.";
  }
  if (values.description.length > 5000) fields.description = "Keep the description to 5,000 characters or fewer.";
  return { values, fields, valid: Object.keys(fields).length === 0 };
}

export type TravelLegValues = { originAirport: string; destinationAirport: string; travelDate: string };
export type TravelLegFormState = {
  error?: string;
  fields?: Partial<Record<keyof TravelLegValues, string>>;
  values?: TravelLegValues;
};
export type LegOrderState = { error?: string; success?: string };

export function validateTravelLeg(form: FormData) {
  const values: TravelLegValues = {
    originAirport: text(form, "originAirport").toUpperCase(),
    destinationAirport: text(form, "destinationAirport").toUpperCase(),
    travelDate: text(form, "travelDate"),
  };
  const fields: NonNullable<TravelLegFormState["fields"]> = {};
  if (!/^[A-Z]{3}$/.test(values.originAirport)) fields.originAirport = "Enter a three-letter airport code.";
  if (!/^[A-Z]{3}$/.test(values.destinationAirport)) fields.destinationAirport = "Enter a three-letter airport code.";
  if (!fields.originAirport && !fields.destinationAirport && values.originAirport === values.destinationAirport) {
    fields.destinationAirport = "Choose a different destination airport.";
  }
  if (!isCalendarDate(values.travelDate)) fields.travelDate = "Enter a valid travel date.";
  return { values, fields, valid: Object.keys(fields).length === 0 };
}

export function moveLegOrder(order: string[], legId: string, direction: unknown): string[] | null {
  if (new Set(order).size !== order.length || (direction !== "up" && direction !== "down")) return null;
  const index = order.indexOf(legId);
  const neighbor = index + (direction === "up" ? -1 : 1);
  if (index < 0 || neighbor < 0 || neighbor >= order.length) return null;
  const moved = [...order];
  [moved[index], moved[neighbor]] = [moved[neighbor], moved[index]];
  return moved;
}
