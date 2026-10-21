import { notFound } from "next/navigation";
import { getMyTrip, getTripLeg } from "@/lib/trips/queries";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TravelLegForm } from "@/components/trips/travel-leg-form";

export const metadata = { title: "Edit travel leg" };
export default async function EditLegPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip?.membership.some(member => member.role === "organizer")) notFound();
  const leg = await getTripLeg(tripId, legId);
  if (!leg) notFound();
  return <div className="max-w-xl">
    <PageHeader title="Edit travel leg" description={trip.name} backHref={`/trips/${tripId}/legs/${legId}`} />
    <Card><TravelLegForm tripId={tripId} leg={{ id: leg.id, updatedAt: leg.updated_at }} locked={leg.proposals.some(proposal => proposal.count > 0)}
      initialValues={{ originAirport: leg.origin_airport, destinationAirport: leg.destination_airport, travelDate: leg.travel_date }} /></Card>
  </div>;
}
