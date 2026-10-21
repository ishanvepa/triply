import "server-only";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyTrip, getTripLeg } from "@/lib/trips/queries";
import { isUuid } from "@/lib/invitations";

const proposalSelect = "*, proposer:profiles!flight_proposals_proposer_id_fkey(display_name), interest:flight_votes!flight_votes_proposal_id_trip_id_trip_leg_id_fkey(count)";

export async function getFlightLegContext(tripId: string, legId: string) {
  const trip = await getMyTrip(tripId);
  if (!trip) return null;
  const leg = await getTripLeg(tripId, legId);
  return leg ? { trip, leg } : null;
}

// Called after membership is verified. Every read remains scoped and subject to RLS.
export async function getFlightProposals(tripId: string, legId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("flight_proposals").select(proposalSelect)
    .eq("trip_id", tripId).eq("trip_leg_id", legId).order("created_at").order("id");
  if (error) throw new Error("Unable to load flight proposals. Please try again.");
  return data;
}

export async function getFlightProposal(tripId: string, legId: string, proposalId: string) {
  await requireUser();
  if (!isUuid(proposalId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("flight_proposals").select(proposalSelect)
    .eq("trip_id", tripId).eq("trip_leg_id", legId).eq("id", proposalId).maybeSingle();
  if (error) throw new Error("Unable to load this flight proposal. Please try again.");
  return data;
}
