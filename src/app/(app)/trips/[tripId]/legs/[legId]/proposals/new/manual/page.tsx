import { notFound } from "next/navigation";
import { getFlightLegContext } from "@/lib/flights/queries";
import { getAirport } from "@/lib/airports";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { FlightForm } from "@/components/flights/flight-form";

export const metadata = { title: "Enter flight manually" };
export default async function ManualFlightPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const { leg } = context;
  const back = `/trips/${tripId}/legs/${legId}`;
  const departureZone = getAirport(leg.origin_airport)?.timeZone;
  const arrivalZone = getAirport(leg.destination_airport)?.timeZone;
  return <div className="max-w-xl">
    <PageHeader title="Enter flight manually" description="Use local airport times (24-hour)." backHref={`${back}/proposals/new`} />
    {leg.selected_proposal_id ? <EmptyState title="Proposals are closed" description="A flight has already been selected for this travel leg."
      action={<ButtonLink href={back} variant="outline">Back to flight options</ButtonLink>} />
      : <FlightForm tripId={tripId} legId={legId} knownDepartureZone={!!departureZone} knownArrivalZone={!!arrivalZone}
        zones={["UTC", ...Intl.supportedValuesOf("timeZone")]}
        initialValues={{ airline: "", flightNumber: "", originAirport: leg.origin_airport, destinationAirport: leg.destination_airport,
          departureDate: leg.travel_date, departureTime: "", departureTimezone: departureZone ?? "", departureOccurrence: "",
          arrivalDate: leg.travel_date, arrivalTime: "", arrivalTimezone: arrivalZone ?? "", arrivalOccurrence: "", price: "", currency: "USD", bookingUrl: "", notes: "" }} />}
  </div>;
}
