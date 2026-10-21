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
    .select("id, name, description, start_date, end_date, membership:trip_members!inner(user_id)")
    .eq("membership.user_id", user.id).eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this trip. Please try again.");
  return data;
}
