import { getAirport } from "@/lib/airports";
import { formatFlightDate, formatFlightTime, type FlightProposal } from "@/lib/flights";

type Schedule = Pick<FlightProposal, "origin_airport" | "destination_airport" | "departure_at" | "arrival_at" | "departure_timezone" | "arrival_timezone">;
export function FlightSchedule({ flight }: { flight: Schedule }) {
  return <dl aria-label="Flight schedule" className="grid grid-cols-1 gap-4 text-sm min-[360px]:grid-cols-2">
    {[
      { label: "Departs", airport: flight.origin_airport, at: flight.departure_at, zone: flight.departure_timezone },
      { label: "Arrives", airport: flight.destination_airport, at: flight.arrival_at, zone: flight.arrival_timezone },
    ].map(side => <div key={side.label} className="min-w-0">
      <dt className="text-xs text-secondary">{side.label} · <span aria-hidden="true">{getAirport(side.airport)?.flag} </span>{side.airport}</dt>
      <dd className="mt-1 space-y-1">
        <time dateTime={side.at} className="block text-lg font-bold">{formatFlightTime(side.at, side.zone)}</time>
        <p className="text-xs text-secondary">{formatFlightDate(side.at, side.zone)}</p>
        <p className="break-words text-xs text-secondary [overflow-wrap:anywhere]">{side.zone}</p>
      </dd>
    </div>)}
  </dl>;
}
