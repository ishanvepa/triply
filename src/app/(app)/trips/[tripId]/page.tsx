import { notFound } from "next/navigation";
import { getMyTrip } from "@/lib/trips/queries";
import { formatTripDates, getTripStatus } from "@/lib/trips/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Trip overview" };
// Read-only destination for Trips Home. Full planning dashboard is Step 2.4.
export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getMyTrip(tripId);
  if (!trip) notFound();
  const status = getTripStatus(trip, new Date().toISOString().slice(0, 10));
  return <div>
    <PageHeader title={trip.name} backHref="/trips" description={formatTripDates(trip.start_date, trip.end_date)} />
    <Card className="space-y-5">
      <Badge tone={status.tone}>{status.label}</Badge>
      {trip.description && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-secondary [overflow-wrap:anywhere]">{trip.description}</p>}
      <p className="text-sm leading-6 text-secondary">Your group&apos;s flight planning space is coming soon.</p>
    </Card>
  </div>;
}
