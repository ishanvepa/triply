"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyTrip } from "@/lib/trips/queries";
import { isUuid } from "@/lib/invitations";
import { moveLegOrder, validateTravelLeg, type LegOrderState, type TravelLegFormState } from "@/lib/trips/validation";

async function canManageLegs(tripId: string) {
  await requireUser();
  if (!isUuid(tripId)) return false;
  const trip = await getMyTrip(tripId);
  return !!trip?.membership.some(member => member.role === "organizer");
}

export async function createTravelLeg(tripId: string, _previous: TravelLegFormState, form: FormData): Promise<TravelLegFormState> {
  if (!await canManageLegs(tripId)) return { error: "Only trip organizers can add travel legs." };
  const { values, fields, valid } = validateTravelLeg(form);
  if (!valid) return { fields, values };
  const supabase = await createClient();
  // The trip row lock assigns the next position atomically. Scope, position,
  // selection, and audit fields are never taken from submitted form fields.
  const { data, error } = await supabase.rpc("create_trip_leg", {
    p_trip_id: tripId, p_origin_airport: values.originAirport,
    p_destination_airport: values.destinationAirport, p_travel_date: values.travelDate,
  });
  if (error || !data) return { error: "We couldn't add this travel leg. Please try again.", values };
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function updateTravelLeg(tripId: string, legId: string, updatedAt: string, _previous: TravelLegFormState, form: FormData): Promise<TravelLegFormState> {
  if (!await canManageLegs(tripId) || !isUuid(legId)) return { error: "Only trip organizers can edit travel legs." };
  const { values, fields, valid } = validateTravelLeg(form);
  if (!valid) return { fields, values };
  const supabase = await createClient();
  // RLS verifies organizer access; the existing row trigger prevents route/date
  // changes once proposals exist, including proposals added after the form opened.
  const { data, error } = await supabase.from("trip_legs").update({
    origin_airport: values.originAirport, destination_airport: values.destinationAirport, travel_date: values.travelDate,
  }).eq("trip_id", tripId).eq("id", legId).eq("updated_at", updatedAt).select("id").maybeSingle();
  if (error) return { error: error.code === "23514"
    ? "This leg has flight proposals. Its route and date can no longer be changed."
    : "We couldn't save this travel leg. Please try again.", values };
  if (!data) return { error: "This leg changed or is no longer available. Reload the page before editing again.", values };
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/legs/${legId}`);
  revalidatePath(`/trips/${tripId}/legs/${legId}/edit`);
  redirect(`/trips/${tripId}/legs/${legId}`);
}

export async function moveTravelLeg(tripId: string, expectedOrder: string[], _previous: LegOrderState, form: FormData): Promise<LegOrderState> {
  if (!await canManageLegs(tripId)) return { error: "Only trip organizers can reorder travel legs." };
  const legId = form.get("legId");
  if (!isUuid(legId) || !Array.isArray(expectedOrder) || !expectedOrder.every(isUuid)) return { error: "Unable to move this travel leg." };
  const order = moveLegOrder(expectedOrder, legId, form.get("direction"));
  if (!order) return { error: "Unable to move this travel leg in that direction." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_trip_legs", {
    p_trip_id: tripId, p_expected_leg_ids: expectedOrder, p_leg_ids: order,
  });
  if (error) {
    if (error.code === "40001") {
      revalidatePath(`/trips/${tripId}`);
      return { error: "The itinerary changed. Review the updated order and try again." };
    }
    return { error: "We couldn't move this travel leg. Please try again." };
  }
  revalidatePath(`/trips/${tripId}`);
  return { success: "Travel leg moved. The itinerary order is updated.", movedLegId: legId };
}
