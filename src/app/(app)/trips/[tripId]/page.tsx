import { notFound } from "next/navigation";
import { getMyTrip, getTripMembers, getTripInvitations } from "@/lib/trips/queries";
import { requireUser } from "@/lib/auth/session";
import { formatTripDates, getTripStatus } from "@/lib/trips/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberList } from "@/components/trips/member-list";
import { InvitationManager } from "@/components/trips/invitation-manager";

export const metadata = { title: "Trip overview" };
// Trip summary and group coordination. Full planning dashboard is Step 2.4.
export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip) notFound();
  const user = await requireUser();
  const organizer = trip.membership.some(member => member.role === "organizer");
  const [members, invitations] = await Promise.all([
    getTripMembers(tripId), organizer ? getTripInvitations(tripId) : Promise.resolve([]),
  ]);
  const now = new Date().toISOString();
  const status = getTripStatus(trip, now.slice(0, 10));
  return <div className="space-y-6">
    <PageHeader title={trip.name} backHref="/trips" description={formatTripDates(trip.start_date, trip.end_date)} />
    <Card className="space-y-5">
      <Badge tone={status.tone}>{status.label}</Badge>
      {trip.description && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-secondary [overflow-wrap:anywhere]">{trip.description}</p>}
      <p className="text-sm leading-6 text-secondary">Your group&apos;s flight planning space is coming soon.</p>
    </Card>
    <MemberList members={members} currentUserId={user.id} />
    {organizer && <InvitationManager tripId={tripId} invitations={invitations} now={now} />}
  </div>;
}
