import { notFound } from "next/navigation";
import { getFlightLegContext, getFlightProposal } from "@/lib/flights/queries";
import { getTripMembers } from "@/lib/trips/queries";
import { safeBookingUrl, formatFlightPrice } from "@/lib/flights";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AirlineDisplay } from "@/components/flights/airline-display";
import { FlightSchedule } from "@/components/flights/flight-schedule";
import { AirportName } from "@/components/trips/airport-name";

export const metadata = { title: "Flight proposal details" };
export default async function ProposalPage({ params }: { params: Promise<{ tripId: string; legId: string; proposalId: string }> }) {
  const { tripId, legId, proposalId } = await params;
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const [flight, members] = await Promise.all([getFlightProposal(tripId, legId, proposalId), getTripMembers(tripId)]);
  if (!flight) notFound();
  const url = safeBookingUrl(flight.booking_url);
  return <div className="space-y-5">
    <PageHeader title={`${flight.airline} flight details`} description={`Proposed by ${flight.proposer?.display_name || "Traveler"}`}
      backHref={`/trips/${tripId}/legs/${legId}`} />
    <Card elevated className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><AirlineDisplay airline={flight.airline} flightNumber={flight.flight_number} heading="h2" />
        <Badge tone={context.leg.selected_proposal_id === flight.id ? "success" : "accent"}>{context.leg.selected_proposal_id === flight.id ? "Selected flight" : "Proposed flight"}</Badge></div>
      <p className="text-sm"><AirportName code={flight.origin_airport} /> → <AirportName code={flight.destination_airport} /></p>
      <FlightSchedule flight={flight} />
    </Card>
    <Card className="space-y-3">
      <h2 className="text-xs font-semibold uppercase text-accent">Price per person</h2>
      <p className="text-page font-bold">{formatFlightPrice(flight.price, flight.currency)}</p>
      {url ? <div className="space-y-1"><a href={url} target="_blank" rel="noopener noreferrer" className="ui-link inline-flex min-h-11 items-center text-sm font-semibold">Open booking link ↗</a><p className="break-all text-xs text-secondary">{new URL(url).hostname}</p></div>
        : <p className="text-sm text-secondary">No booking link provided.</p>}
      <p className="text-xs leading-5 text-secondary">Prices are snapshots. Check the current fare and availability on the booking site.</p>
    </Card>
    {flight.notes && <Card className="space-y-3"><h2 className="text-sm font-bold">Notes</h2><p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{flight.notes}</p></Card>}
    <Card className="space-y-2"><h2 className="text-xs font-semibold uppercase text-accent">Group interest</h2><p className="text-sm">{flight.interest[0]?.count ?? 0} interested in this option · {members.length} {members.length === 1 ? "traveler" : "travelers"} in the group</p></Card>
  </div>;
}
