import { notFound } from "next/navigation";
import { getFlightLegContext, getFlightProposal, getFlightBookings } from "@/lib/flights/queries";
import { getTripMembers } from "@/lib/trips/queries";
import { summarizeLeg } from "@/lib/trips/dashboard";
import { formatFlightPrice, safeBookingUrl } from "@/lib/flights";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AirlineDisplay } from "@/components/flights/airline-display";
import { FlightSchedule } from "@/components/flights/flight-schedule";
import { AirportName } from "@/components/trips/airport-name";

export const metadata = { title: "Selected flight" };
export default async function SelectedFlightPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const { trip, leg } = context;
  const base = `/trips/${tripId}/legs/${legId}`;
  if (!leg.selected_proposal_id) return <div className="space-y-5">
    <PageHeader title="Selected flight" description={trip.name} backHref={`/trips/${tripId}`} />
    <EmptyState title="No flight selected" description="The organizer hasn't selected a flight for this leg yet."
      action={<ButtonLink href={`${base}/decision`} variant="outline">View group decision →</ButtonLink>} />
  </div>;
  const [flight, members, bookings] = await Promise.all([
    getFlightProposal(tripId, legId, leg.selected_proposal_id), getTripMembers(tripId),
    getFlightBookings(tripId, legId, leg.selected_proposal_id),
  ]);
  if (!flight) notFound();
  const progress = summarizeLeg(leg, [flight], bookings, members.map(member => member.user_id));
  const description = progress.participating
    ? `${progress.booked} of ${progress.participating} travelers booked` : "No participating travelers";
  const url = safeBookingUrl(flight.booking_url);
  return <div className="space-y-5">
    <PageHeader title="Selected flight" description={trip.name} backHref={`/trips/${tripId}`} />
    <Card elevated className="space-y-5" role="region" aria-label="Selected flight details">
      <p className="text-xs font-bold uppercase text-success">✓ Group selected · Voting closed</p>
      <div className="[&_h2]:text-2xl"><AirlineDisplay airline={flight.airline} flightNumber={flight.flight_number} heading="h2" /></div>
      <p className="text-base font-bold"><AirportName code={flight.origin_airport} /> → <AirportName code={flight.destination_airport} /></p>
      <FlightSchedule flight={flight} />
      <div className="space-y-1"><p className="text-base font-bold">{formatFlightPrice(flight.price, flight.currency)}{flight.price !== null && " per person"}</p>
        <p className="text-xs text-secondary">Price entered when proposed</p></div>
    </Card>
    <Card className="space-y-4" role="region" aria-label="Group booking progress">
      <h2 className="text-xs font-bold uppercase text-secondary">Booking status</h2>
      <p className="text-lg font-bold">{description}</p>
      <div role="progressbar" aria-label="Group booking progress" aria-valuemin={0}
        aria-valuemax={progress.participating || 1} aria-valuenow={progress.booked} aria-valuetext={description}
        className="h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress.participating ? progress.booked / progress.participating * 100 : 0}%` }} />
      </div>
      {progress.participating > 0 && <p className="text-xs text-secondary">✓ {progress.booked} booked · {progress.participating - progress.booked} still need to book</p>}
      {progress.notJoining > 0 && <p className="text-xs text-secondary">{progress.notJoining} not joining · Excluded from booking progress</p>}
      <p className="text-xs text-accent">Each traveler books individually</p>
      <p className="text-xs leading-5 text-secondary">Booking progress is self-reported by current members. triply has not verified these purchases.</p>
    </Card>
    <div className="space-y-3 text-center">
      {url ? <><a href={url} target="_blank" rel="noopener noreferrer" className={buttonStyles()}>Book on airline site ↗</a>
        <p className="break-all text-xs text-secondary">Opens {new URL(url).hostname} in a new tab</p></>
        : <p className="text-sm text-secondary">No booking link provided. Find this flight on the airline&apos;s site to book.</p>}
      <p className="text-xs leading-5 text-secondary">The proposed price and seat availability are not guaranteed. The link may open a general search or booking page. Check the flight details and current fare before purchasing.</p>
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      <ButtonLink href={`${base}/decision`} variant="ghost">View group decision →</ButtonLink>
      <ButtonLink href={base} variant="ghost">View all proposals →</ButtonLink>
    </div>
  </div>;
}
