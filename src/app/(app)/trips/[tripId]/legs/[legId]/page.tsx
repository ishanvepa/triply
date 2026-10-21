import { notFound } from "next/navigation";
import { getMyTrip, getTripMembers, getTripPlanningData } from "@/lib/trips/queries";
import { isUuid } from "@/lib/invitations";
import { summarizeLeg } from "@/lib/trips/dashboard";
import { airportName } from "@/lib/airports";
import { formatTripDates } from "@/lib/trips/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Flight proposals" };

function localTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone, timeZoneName: "short" }).format(new Date(value));
}

export default async function LegProposalsPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip || !isUuid(legId)) notFound();
  const [planning, members] = await Promise.all([getTripPlanningData(tripId), getTripMembers(tripId)]);
  const leg = planning.legs.find(leg => leg.id === legId);
  if (!leg) notFound();
  const summary = summarizeLeg(leg, planning.proposals, planning.bookings, members.map(member => member.user_id));
  const proposals = planning.proposals.filter(proposal => proposal.trip_leg_id === legId);
  return <div className="space-y-6">
    <PageHeader title={`${airportName(leg.origin_airport)} → ${airportName(leg.destination_airport)}`}
      description={`${trip.name} · ${formatTripDates(leg.travel_date, leg.travel_date)}`} backHref={`/trips/${tripId}`}
      action={trip.membership.some(member => member.role === "organizer")
        ? <ButtonLink href={`/trips/${tripId}/legs/${legId}/edit`} variant="outline">Edit leg</ButtonLink> : undefined} />
    <Badge tone={summary.status.tone}>{summary.status.label}</Badge>
    <section aria-labelledby="proposals-heading" className="space-y-4">
      <h2 id="proposals-heading" className="text-base font-bold">Flight proposals <span className="font-normal text-secondary">({proposals.length})</span></h2>
      {proposals.length ? <ul aria-label="Flight proposals" className="space-y-4">
        {proposals.map(proposal => <li key={proposal.id}><Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="break-words font-bold [overflow-wrap:anywhere]">{proposal.airline}{proposal.flight_number && ` · ${proposal.flight_number}`}</h3>
            {proposal.id === leg.selected_proposal_id && <Badge tone="success">Selected flight</Badge>}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-secondary">Departs · {leg.origin_airport}</dt><dd className="mt-1">{localTime(proposal.departure_at, proposal.departure_timezone)}</dd></div>
            <div><dt className="text-secondary">Arrives · {leg.destination_airport}</dt><dd className="mt-1">{localTime(proposal.arrival_at, proposal.arrival_timezone)}</dd></div>
            <div><dt className="text-secondary">Proposed price</dt><dd className="mt-1">{proposal.price === null ? "Not provided" : `${proposal.currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(proposal.price)}`}</dd></div>
          </dl>
        </Card></li>)}
      </ul> : <EmptyState title="No flight proposals yet" description="No one has proposed a flight for this travel leg." />}
    </section>
  </div>;
}
