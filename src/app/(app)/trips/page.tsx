import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";
import { getMyTrips } from "@/lib/trips/queries";

export const metadata: Metadata = { title: "Trips" };
export default async function TripsPage() {
  const trips = await getMyTrips();
  const today = new Date().toISOString().slice(0, 10);
  return <div className="flex min-h-[calc(100svh-15rem)] flex-col">
    <PageHeader title="Your trips" description="Plan together. Decide together." />
    {trips.length === 0
      ? <EmptyState title="No trips yet." description="Create your first trip and start planning together." />
      : <ul aria-label="Your trips" className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
        {trips.map(trip => <li key={trip.id} className="min-w-0"><TripCard trip={trip} today={today} /></li>)}
      </ul>}
    <div className="mt-auto flex justify-center pt-8">
      <ButtonLink href="/trips/new" variant="outline" className="w-full max-w-[250px]">+ New trip</ButtonLink>
    </div>
  </div>;
}
