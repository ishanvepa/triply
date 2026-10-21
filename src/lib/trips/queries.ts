import "server-only";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Use the verified session and membership explicitly as well as database RLS.
// Never use a service-role client or globally cache user-specific results.
export async function getMyTrips() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("trips")
    .select("id, name, start_date, end_date, membership:trip_members!inner(user_id)")
    .eq("membership.user_id", user.id)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error("Unable to load your trips. Please try again.");
  return data;
}

export async function getMyTrip(id: string) {
  const user = await requireUser();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("trips")
    .select("id, name, description, start_date, end_date, membership:trip_members!inner(user_id, role)")
    .eq("membership.user_id", user.id).eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this trip. Please try again.");
  return data;
}

export async function getTripMembers(tripId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("trip_members")
    .select("user_id, role, profile:profiles!trip_members_user_id_fkey(display_name)")
    .eq("trip_id", tripId).order("role").order("joined_at").order("user_id");
  if (error) throw new Error("Unable to load trip members. Please try again.");
  return data;
}

export async function getTripInvitations(tripId: string) {
  await requireUser();
  const supabase = await createClient();
  // No token hashes or raw tokens are included in the management list.
  const { data, error } = await supabase.from("trip_invitations")
    .select("id, created_at, expires_at, revoked_at").eq("trip_id", tripId)
    .order("created_at", { ascending: false }).order("id");
  if (error) throw new Error("Unable to load invitations. Please try again.");
  return data;
}

// Call after getMyTrip has confirmed membership. Each request is additionally
// trip-scoped and subject to RLS; failures must never appear as empty progress.
export async function getTripPlanningData(tripId: string) {
  await requireUser();
  const supabase = await createClient();
  const [legs, proposals, bookings] = await Promise.all([
    supabase.from("trip_legs")
      .select("id, origin_airport, destination_airport, travel_date, position, selected_proposal_id")
      .eq("trip_id", tripId).order("position").order("id"),
    supabase.from("flight_proposals")
      .select("id, trip_leg_id, airline, flight_number, departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency")
      .eq("trip_id", tripId).order("created_at").order("id"),
    supabase.from("flight_bookings").select("trip_leg_id, proposal_id, user_id, status").eq("trip_id", tripId),
  ]);
  if (legs.error || proposals.error || bookings.error) throw new Error("Unable to load trip planning. Please try again.");
  return { legs: legs.data, proposals: proposals.data, bookings: bookings.data };
}
