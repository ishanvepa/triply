import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getFlightLegContext, getFlightProposals, getFlightVotes } from "@/lib/flights/queries";
import { getTripMembers } from "@/lib/trips/queries";
import { summarizeVotes } from "@/lib/voting";
import { formatFlightPrice, formatFlightTime, formatFlightDate } from "@/lib/flights";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AirportName } from "@/components/trips/airport-name";
import { AirlineDisplay } from "@/components/flights/airline-display";
import { DecisionControls, RefreshDecision } from "@/components/flights/decision-controls";

export const metadata = { title: "Group decision" };
export default async function DecisionPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const user = await requireUser();
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const { trip, leg } = context;
  const [flights, members, votes] = await Promise.all([getFlightProposals(tripId, legId), getTripMembers(tripId), getFlightVotes(tripId, legId)]);
  const results = summarizeVotes(flights.map(f => f.id), members.map(m => m.user_id), votes, user.id);
  const base = `/trips/${tripId}/legs/${legId}`;
  const organizer = trip.membership.some(member => member.role === "organizer");
  const ranked = [...results.options].sort((a, b) => b.count - a.count);
  return <div className="space-y-5">
    <PageHeader title="Group decision" description="Compare group preferences for this route" backHref={base} />
    <p className="text-xs font-bold uppercase text-secondary"><AirportName code={leg.origin_airport} /> → <AirportName code={leg.destination_airport} /> · {results.eligible} travelers</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-secondary">{results.cast} of {results.eligible} votes cast · {results.undecided} undecided</p><RefreshDecision /></div>
    {leg.selected_proposal_id && <Card className="space-y-2 border-success [&]:bg-success-surface"><h2 className="font-bold text-success">Flight selected · Voting closed</h2><p className="text-sm">The organizer selected {flights.find(f => f.id === leg.selected_proposal_id)?.airline || "a flight"} for this leg.</p></Card>}
    {flights.length ? <ul aria-label="Voting results" className="space-y-4">
      {ranked.map(result => {
        const flight = flights.find(f => f.id === result.id)!;
        const leading = results.leaders.includes(flight.id);
        const selected = leg.selected_proposal_id === flight.id;
        return <li key={flight.id}><Card className={`space-y-4 ${selected || leading ? "border-success [&]:bg-success-surface" : ""}`}>
          <div className="flex flex-wrap items-center gap-2"><p className={`text-xs font-bold uppercase ${selected || leading ? "text-success" : "text-secondary"}`}>{selected ? "Selected flight" : leading ? results.leaders.length > 1 ? "Tied for lead" : "Leading option" : "Other option"}</p>{results.ownVote === flight.id && <Badge tone="accent">Your vote</Badge>}</div>
          <div className="[&_h2]:text-xl"><AirlineDisplay airline={flight.airline} flightNumber={flight.flight_number} heading="h2" /></div>
          <p className="text-sm">{formatFlightPrice(flight.price, flight.currency)} · {flight.origin_airport} → {flight.destination_airport}</p>
          <p className="text-xs leading-5 text-secondary">{formatFlightTime(flight.departure_at, flight.departure_timezone)} → {formatFlightTime(flight.arrival_at, flight.arrival_timezone)} · Local airport times<br />{formatFlightDate(flight.departure_at, flight.departure_timezone)} → {formatFlightDate(flight.arrival_at, flight.arrival_timezone)}</p>
          <p className={`text-sm font-bold ${leading ? "text-success" : "text-accent"}`}>{result.count} of {results.eligible} votes</p>
          <div role="progressbar" aria-label={`${flight.airline} support`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.percent} className="h-1.5 overflow-hidden rounded-full bg-elevated"><div className={`h-full rounded-full ${leading ? "bg-success" : "bg-accent"}`} style={{ width: `${result.percent}%` }} /></div>
          <p className="text-xs text-secondary">{result.percent}% support</p>
          <ButtonLink href={`${base}/proposals/${flight.id}`} variant="ghost" className="w-full">Flight details →</ButtonLink>
          <DecisionControls tripId={tripId} legId={legId} proposalId={flight.id} updatedAt={leg.updated_at} airline={flight.airline} ownVote={results.ownVote} organizer={organizer} closed={!!leg.selected_proposal_id} />
        </Card></li>;
      })}
    </ul> : <EmptyState title="No flights to vote on" description="Propose a flight for this route to start comparing preferences." />}
    <p className="text-xs leading-5 text-secondary">Each member has one vote and can change it until selection. Support is based on all current members. The organizer confirms the final choice and closes voting.</p>
    {!flights.length && <ButtonLink href={`${base}/proposals/new`} variant="ghost">+ Propose option</ButtonLink>}
  </div>;
}
