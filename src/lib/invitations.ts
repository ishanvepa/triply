export function isInvitationToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export type InvitationSummary = { id: string; created_at: string; expires_at: string; revoked_at: string | null };
export function invitationStatus(invitation: Pick<InvitationSummary, "expires_at" | "revoked_at">, now: string) {
  if (invitation.revoked_at) return "Revoked";
  return Date.parse(invitation.expires_at) <= Date.parse(now) ? "Expired" : "Active";
}
export function formatInvitationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", timeZone: "UTC", timeZoneName: "short",
  }).format(new Date(value));
}
export const unavailableInvitation = "This invitation is invalid, expired, or revoked. Ask the organizer for a new link.";
export type InvitationState = {
  error?: string;
  success?: string;
  invitation?: { id: string; url: string; expiresAt: string };
};
