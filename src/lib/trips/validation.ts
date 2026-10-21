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
