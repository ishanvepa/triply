import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyTrip, getTripMembers, getTripInvitations, getTripPlanningData } from "@/lib/trips/queries";
import { requireUser } from "@/lib/auth/session";
import { formatTripDates, getTripStatus } from "@/lib/trips/format";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MemberList } from "@/components/trips/member-list";
import { InvitationManager } from "@/components/trips/invitation-manager";
import { PlanningProgress } from "@/components/trips/planning-progress";
import { TravelLegCard } from "@/components/trips/travel-leg-card";
import { AirportName } from "@/components/trips/airport-name";
import { summarizeDashboard } from "@/lib/trips/dashboard";

export const metadata = { title: "Trip dashboard" };
export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip) notFound();
  const user = await requireUser();
  const organizer = trip.membership.some(member => member.role === "organizer");
  const [members, invitations, planning] = await Promise.all([
    getTripMembers(tripId), organizer ? getTripInvitations(tripId) : Promise.resolve([]),
    getTripPlanningData(tripId),
  ]);
  const dashboard = summarizeDashboard(planning.legs, planning.proposals, planning.bookings, members.map(member => member.user_id));
  const now = new Date().toISOString();
  const status = getTripStatus(trip, now.slice(0, 10));
  return <div className="space-y-6">
    <section aria-label="Trip summary" className="space-y-3">
      <PageHeader title={trip.name} backHref="/trips" description={formatTripDates(trip.start_date, trip.end_date)} />
      <p aria-label="Destinations" className="text-sm leading-6 text-secondary">
        {dashboard.destinations.length ? dashboard.destinations.map((code, index) => <span key={code}>
          {index > 0 && " · "}<AirportName code={code} />
        </span>) : "Destinations will appear when travel legs are added."}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Link href="#group" className="ui-link inline-flex min-h-11 items-center text-sm">{members.length} {members.length === 1 ? "traveler" : "travelers"}</Link>
        {organizer && <Link href="#invitations" className="ui-link inline-flex min-h-11 items-center text-sm">Invite friends +</Link>}
      </div>
      {trip.description && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-secondary [overflow-wrap:anywhere]">{trip.description}</p>}
    </section>
    <PlanningProgress {...dashboard} />
    <section aria-labelledby="travel-legs-heading" className="space-y-4">
      <h2 id="travel-legs-heading" className="text-base font-bold">Travel legs <span className="font-normal text-secondary">({dashboard.totalLegs})</span></h2>
      {dashboard.legs.length ? <ol aria-label="Travel legs" className="space-y-4">
        {dashboard.legs.map((leg, index) => <li key={leg.id}><TravelLegCard tripId={tripId} leg={leg} index={index} /></li>)}
      </ol> : <EmptyState title="No travel legs yet" description="Your route will appear here once travel legs are added. Each leg will show flight options and planning progress." />}
    </section>
    <div id="group" className="scroll-mt-6"><MemberList members={members} currentUserId={user.id} /></div>
    {organizer && <div id="invitations" className="scroll-mt-6"><InvitationManager tripId={tripId} invitations={invitations} now={now} /></div>}
  </div>;
}
