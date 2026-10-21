import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AirlineDisplay } from "./airline-display";
import { FlightSchedule } from "./flight-schedule";
import { formatFlightPrice, type FlightProposal } from "@/lib/flights";

export function FlightCard({ flight, selected }: { flight: FlightProposal; selected: boolean }) {
  return <Link href={`/trips/${flight.trip_id}/legs/${flight.trip_leg_id}/proposals/${flight.id}`} className="block rounded-card transition-colors hover:outline hover:outline-accent">
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AirlineDisplay airline={flight.airline} flightNumber={flight.flight_number} />
        <p className="text-sm font-bold">{formatFlightPrice(flight.price, flight.currency)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
        <span>{flight.interest[0]?.count ?? 0} interested · Proposed by {flight.proposer?.display_name || "Traveler"}</span>
        {selected && <Badge tone="success">Selected flight</Badge>}
      </div>
      <FlightSchedule flight={flight} />
      <p className="text-right text-xs font-semibold text-accent">Compare details ›</p>
    </Card>
  </Link>;
}
