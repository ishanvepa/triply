"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFlightLegContext } from "@/lib/flights/queries";
import { getAirport } from "@/lib/airports";
import { validateFlight, type FlightFormState } from "@/lib/flights";

export async function createFlightProposal(tripId: string, legId: string, _previous: FlightFormState, form: FormData): Promise<FlightFormState> {
  await requireUser();
  const context = await getFlightLegContext(tripId, legId);
  if (!context) return { error: "This travel leg is unavailable, or you are no longer a member of this trip." };
  const { leg } = context;
  const { values, fields, data } = validateFlight(form, {
    ...leg, departureTimezone: getAirport(leg.origin_airport)?.timeZone, arrivalTimezone: getAirport(leg.destination_airport)?.timeZone,
  });
  if (leg.selected_proposal_id) return { error: "A flight has been selected. New proposals are closed for this leg.", values };
  if (!data) return { values, fields };
  const supabase = await createClient();
  // Only validated fields are written. The database derives proposer_id from
  // auth.uid(), checks membership/route/date, and locks the leg against selection.
  const { error } = await supabase.from("flight_proposals").insert({ ...data, trip_id: tripId, trip_leg_id: legId });
  if (error) return { values, error: error.code === "23514"
    ? "This travel leg changed or a flight was selected. Return to flight options and review the leg before trying again."
    : "We couldn't save this flight proposal. Please try again." };
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/legs/${legId}`);
  redirect(`/trips/${tripId}/legs/${legId}`);
}
