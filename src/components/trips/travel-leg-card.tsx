import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AirportName } from "./airport-name";
import type { LegSummary } from "@/lib/trips/dashboard";

export function TravelLegCard({ tripId, leg, index }: { tripId: string; leg: LegSummary; index: number }) {
  const surface = leg.status.tone === "success" ? "bg-success-surface" : leg.status.tone === "warning" ? "bg-warning-surface" : "bg-surface";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${leg.travel_date}T00:00:00Z`));
  return <Link href={`/trips/${tripId}/legs/${leg.id}`} className={`block space-y-3 rounded-card border border-border p-4 transition-colors hover:border-accent sm:p-5 ${surface}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-secondary">Leg {index + 1} · {date}</p>
        <h3 className="break-words text-base font-bold"><AirportName code={leg.origin_airport} /> <span aria-hidden="true">→</span><span className="sr-only"> to </span> <AirportName code={leg.destination_airport} /></h3>
      </div>
      <span aria-hidden="true" className="text-xl text-secondary">›</span>
    </div>
    <Badge tone={leg.status.tone}>{leg.status.label}</Badge>
    <p className="text-xs leading-5 text-accent">{leg.proposalCount} {leg.proposalCount === 1 ? "flight option" : "flight options"} · View proposals</p>
    {leg.selected_proposal_id && <p className="text-xs leading-5 text-secondary">
      {leg.participating ? `${leg.booked} of ${leg.participating} travelers booked` : "No participating travelers"}
      {leg.notJoining > 0 && ` · ${leg.notJoining} not joining`}
    </p>}
  </Link>;
}
