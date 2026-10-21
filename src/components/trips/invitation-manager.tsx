"use client";
import { useActionState } from "react";
import { createInvitation, revokeInvitation } from "@/app/(app)/invite/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorMessage } from "@/components/ui/error-message";
import { ShareInvitation } from "./share-invitation";
import { invitationStatus, formatInvitationTime, type InvitationSummary } from "@/lib/invitations";

function InvitationRow({ tripId, invitation, now }: { tripId: string; invitation: InvitationSummary; now: string }) {
  const [state, action, pending] = useActionState(revokeInvitation.bind(null, tripId, invitation.id), {});
  const status = invitationStatus(invitation, now);
  return <li className="space-y-3 rounded-card border border-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Badge tone={status === "Active" ? "success" : status === "Expired" ? "warning" : "neutral"}>{status}</Badge>
      {status === "Active" && <form action={action}><Button type="submit" variant="ghost" loading={pending}>{pending ? "Revoking…" : "Revoke link"}</Button></form>}
    </div>
    <p className="text-xs leading-5 text-secondary">Created {formatInvitationTime(invitation.created_at)}</p>
    <p className="text-xs leading-5 text-secondary">Expires {formatInvitationTime(invitation.expires_at)}</p>
    {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    {state.success && <p role="status" className="text-sm text-success">{state.success}</p>}
  </li>;
}

export function InvitationManager({ tripId, invitations, now }: { tripId: string; invitations: InvitationSummary[]; now: string }) {
  const [state, action, pending] = useActionState(createInvitation.bind(null, tripId), {});
  const generated = state.invitation;
  const generatedRecord = invitations.find(invitation => invitation.id === generated?.id);
  const showLink = generated && generatedRecord && invitationStatus(generatedRecord, now) === "Active";
  return <Card role="region" aria-labelledby="invitations-heading" className="space-y-5">
    <div>
      <h2 id="invitations-heading" className="text-base font-bold">Invite friends</h2>
      <p className="mt-2 text-sm leading-6 text-secondary">Create a link that friends can use to join. Each link expires after 7 days; you can revoke it earlier.</p>
    </div>
    <form action={action}><Button type="submit" variant="outline" loading={pending}>{pending ? "Creating link…" : "Create invitation link"}</Button></form>
    {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    {showLink && <div className="rounded-card bg-elevated p-4"><ShareInvitation key={generated.id} url={generated.url} /></div>}
    {invitations.length > 0 && <ul aria-label="Invitation links" className="space-y-3">
      {invitations.map(invitation => <InvitationRow key={invitation.id} tripId={tripId} invitation={invitation} now={now} />)}
    </ul>}
  </Card>;
}
