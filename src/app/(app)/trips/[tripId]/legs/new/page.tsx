import { notFound } from "next/navigation";
import { getMyTrip } from "@/lib/trips/queries";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TravelLegForm } from "@/components/trips/travel-leg-form";

export const metadata = { title: "Add travel leg" };
export default async function NewLegPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip?.membership.some(member => member.role === "organizer")) notFound();
  return <div className="max-w-xl">
    <PageHeader title="Add travel leg" description={trip.name} backHref={`/trips/${tripId}`} />
    <Card><TravelLegForm tripId={tripId} initialValues={{ originAirport: "", destinationAirport: "", travelDate: trip.start_date }} /></Card>
  </div>;
}
