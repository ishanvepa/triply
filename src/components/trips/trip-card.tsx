import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTripDates, getTripStatus, type TripSummary } from "@/lib/trips/format";

export function TripCard({ trip, today }: { trip: TripSummary; today: string }) {
  const status = getTripStatus(trip, today);
  return <Link href={`/trips/${trip.id}`} className="group block min-w-0 rounded-card">
    <Card className="space-y-4 transition-colors group-hover:border-accent group-focus-visible:border-accent">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 break-words text-base font-bold [overflow-wrap:anywhere]">{trip.name}</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-sm leading-6 text-secondary">{formatTripDates(trip.start_date, trip.end_date)}</p>
      <p className="flex items-center gap-2 text-xs text-accent">View details <span aria-hidden="true">→</span></p>
    </Card>
  </Link>;
}
