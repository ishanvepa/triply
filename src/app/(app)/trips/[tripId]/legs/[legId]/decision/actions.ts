"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFlightLegContext, getFlightProposal } from "@/lib/flights/queries";
import { isUuid } from "@/lib/invitations";

export type DecisionState = { error?: string; success?: string };

export async function submitDecision(
  tripId: string, legId: string, proposalId: string, expectedUpdatedAt: string,
  _previous: DecisionState, form: FormData,
): Promise<DecisionState> {
  const user = await requireUser();
  if (![tripId, legId, proposalId].every(isUuid)) return { error: "This flight is unavailable." };
  const context = await getFlightLegContext(tripId, legId);
  if (!context) return { error: "This travel leg is unavailable, or you are no longer a member." };
  const refresh = () => {
    revalidatePath(`/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}/legs/${legId}`);
    revalidatePath(`/trips/${tripId}/legs/${legId}/decision`);
    revalidatePath("/trips/[tripId]/legs/[legId]/proposals/[proposalId]", "page");
  };
  if (context.leg.selected_proposal_id) {
    refresh();
    return { error: "A flight has already been selected. Voting is closed." };
  }
  const flight = await getFlightProposal(tripId, legId, proposalId);
  if (!flight) { refresh(); return { error: "This proposal was removed. Review the remaining options." }; }
  const supabase = await createClient();
  const intent = form.get("intent");
  if (intent === "select") {
    if (!context.trip.membership.some(member => member.role === "organizer")) return { error: "Only the organizer can select a flight." };
    if (form.get("confirmed") !== "yes") return { error: "Review and confirm this flight before selecting it." };
    // Compare-and-set prevents a stale tab from replacing a decision or selecting a changed leg.
    const { data, error } = await supabase.from("trip_legs").update({ selected_proposal_id: proposalId })
      .eq("trip_id", tripId).eq("id", legId).is("selected_proposal_id", null)
      .eq("updated_at", expectedUpdatedAt).select("id");
    refresh();
    if (error) return { error: "We couldn't select this flight. Refresh the results and try again." };
    if (!data.length) return { error: "This leg changed or a flight was selected. Review the latest decision." };
    return { success: "Flight selected. Voting is now closed." };
  }
  if (intent !== "vote") return { error: "Choose a valid action." };
  // Ownership comes from the verified session and auth.uid(), never submitted fields.
  // Separate update/insert respects the database's column grants (scope is immutable).
  const updateVote = () => supabase.from("flight_votes").update({ proposal_id: proposalId })
    .eq("trip_id", tripId).eq("trip_leg_id", legId).eq("user_id", user.id).select("proposal_id");
  const result = await updateVote();
  let voteError = result.error;
  if (!result.error && !result.data.length) {
    const inserted = await supabase.from("flight_votes").insert({ trip_id: tripId, trip_leg_id: legId, proposal_id: proposalId });
    // Two tabs can both observe no vote; the unique key resolves the race.
    if (inserted.error?.code === "23505") {
      const retry = await updateVote();
      voteError = retry.error;
      if (!retry.error && !retry.data.length) return { error: "Your membership changed. Refresh the results before voting again." };
    } else voteError = inserted.error;
  }
  refresh();
  if (voteError) return { error: voteError.code === "23514"
    ? "A flight was selected. Voting is now closed."
    : "We couldn't save your vote. Refresh the results and try again." };
  return { success: "Your vote has been saved." };
}
