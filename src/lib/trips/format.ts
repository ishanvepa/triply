export type TripSummary = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

// Postgres DATE values are calendar dates. Always format in UTC to avoid
// shifting a trip back one day in browsers west of UTC.
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export function formatTripDates(start: string, end: string) {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  return start === end ? dateFormat.format(first) : dateFormat.formatRange(first, last);
}

// These labels describe the date window, not flight selection or booking.
export function getTripStatus(trip: Pick<TripSummary, "start_date" | "end_date">, today: string) {
  if (today < trip.start_date) return { label: "Upcoming", tone: "accent" } as const;
  if (today > trip.end_date) return { label: "Past", tone: "neutral" } as const;
  return { label: "In progress", tone: "success" } as const;
}
