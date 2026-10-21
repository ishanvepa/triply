"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getSiteOrigin } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";
import { isInvitationToken, isUuid, unavailableInvitation, type InvitationState } from "@/lib/invitations";

export async function createInvitation(tripId: string): Promise<InvitationState> {
  await requireUser();
  if (!isUuid(tripId)) return { error: "Unable to create an invitation for this trip." };
  // Resolve the configured origin before creating a link; never trust the Host header.
  const origin = getSiteOrigin();
  const supabase = await createClient();
  // The RPC verifies organizer access and creates a hashed, seven-day invitation.
  const { data, error } = await supabase.rpc("create_trip_invitation", { p_trip_id: tripId }).single();
  if (error || !data) return { error: error?.code === "42501"
    ? "Only trip organizers can create invitations." : "We couldn't create an invitation. Please try again." };
  revalidatePath(`/trips/${tripId}`);
  return { invitation: { id: data.invitation_id, url: `${origin}/invite/${data.token}`, expiresAt: data.expires_at } };
}

export async function revokeInvitation(tripId: string, invitationId: string): Promise<InvitationState> {
  await requireUser();
  if (!isUuid(tripId) || !isUuid(invitationId)) return { error: "Unable to revoke this invitation." };
  const supabase = await createClient();
  // Organizer-only RLS applies to the update, including forged trip or invite IDs.
  const { data, error } = await supabase.from("trip_invitations").update({ revoked_at: new Date().toISOString() })
    .eq("trip_id", tripId).eq("id", invitationId).is("revoked_at", null).select("id").maybeSingle();
  if (error || !data) return { error: "We couldn't revoke this invitation. Refresh the page and try again." };
  revalidatePath(`/trips/${tripId}`);
  return { success: "Invitation revoked." };
}

export async function acceptInvitation(token: string): Promise<InvitationState> {
  await requireUser();
  if (!isInvitationToken(token)) return { error: unavailableInvitation };
  const supabase = await createClient();
  // The locked RPC checks expiry/revocation and inserts membership ON CONFLICT
  // DO NOTHING, so repeated or concurrent acceptance never duplicates a member.
  const { data: tripId, error } = await supabase.rpc("accept_trip_invitation", { p_token: token });
  if (error || !tripId) return { error: error?.code === "22023" ? unavailableInvitation
    : "We couldn't join this trip. Please try again." };
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
