import { Card } from "@/components/ui/card";
import { AirportName } from "@/components/trips/airport-name";
import { formatTripDates } from "@/lib/trips/format";

export function FlightRoute({ leg }: { leg: { origin_airport: string; destination_airport: string; travel_date: string } }) {
  return <Card role="region" aria-label="Travel leg" className="space-y-2">
    <p className="text-xs font-semibold uppercase text-accent">Route</p>
    <h2 className="text-base font-bold"><AirportName code={leg.origin_airport} /> → <AirportName code={leg.destination_airport} /></h2>
    <p className="text-xs text-secondary">{formatTripDates(leg.travel_date, leg.travel_date)} · Local airport times</p>
  </Card>;
}
