import { notFound } from "next/navigation";
import { getFlightLegContext, getFlightProposals } from "@/lib/flights/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { FlightCard } from "@/components/flights/flight-card";
import { FlightRoute } from "@/components/flights/flight-route";

export const metadata = { title: "Flight options" };
export default async function LegProposalsPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const { trip, leg } = context;
  const proposals = await getFlightProposals(tripId, legId);
  return <div className="space-y-6">
    <PageHeader title="Flight options" description={trip.name} backHref={`/trips/${tripId}`}
      action={trip.membership.some(member => member.role === "organizer")
        ? <ButtonLink href={`/trips/${tripId}/legs/${legId}/edit`} variant="outline">Edit leg</ButtonLink> : undefined} />
    <FlightRoute leg={leg} />
    {leg.selected_proposal_id && <ButtonLink href={`/trips/${tripId}/legs/${legId}/selected`} className="w-full">View selected flight →</ButtonLink>}
    <ButtonLink href={`/trips/${tripId}/legs/${legId}/decision`} variant="outline" className="w-full">Group decision →</ButtonLink>
    <section aria-labelledby="proposals-heading" className="space-y-4 border-t border-border pt-5">
      <div><h2 id="proposals-heading" className="text-base font-bold">Flight proposals <span className="font-normal text-secondary">({proposals.length})</span></h2>
        <p className="mt-2 text-xs text-secondary">Compare proposed options for this route.</p></div>
      {proposals.length ? <ul aria-label="Flight proposals" className="space-y-4">
        {proposals.map(flight => <li key={flight.id}><FlightCard flight={flight} selected={leg.selected_proposal_id === flight.id} /></li>)}
      </ul> : <EmptyState title="No flight proposals yet" description="No one has proposed a flight for this travel leg." />}
    </section>
    {leg.selected_proposal_id ? <p className="text-sm leading-6 text-secondary">A flight has been selected. New proposals are closed for this leg.</p>
      : <div className="text-center"><ButtonLink href={`/trips/${tripId}/legs/${legId}/proposals/new`} variant="ghost">+ Propose option</ButtonLink></div>}
  </div>;
}
