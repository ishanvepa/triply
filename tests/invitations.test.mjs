import assert from "node:assert/strict";
import test from "node:test";
import { isInvitationToken, isUuid, invitationStatus, formatInvitationTime } from "../src/lib/invitations.ts";

test("invitation tokens and IDs reject malformed route input", () => {
  assert.equal(isInvitationToken("ab12".repeat(16)), true);
  for (const token of [null, undefined, ["a".repeat(64)], {}, "", "ab12".repeat(15), "a".repeat(65), "A".repeat(64), "a".repeat(63) + "/", " a".repeat(32)]) assert.equal(isInvitationToken(token), false);
  assert.equal(isUuid("a1b2c3d4-1234-1234-1234-a1b2c3d4e5f6"), true);
  assert.equal(isUuid("not-a-trip"), false);
  assert.equal(isUuid(["a1b2c3d4-1234-1234-1234-a1b2c3d4e5f6"]), false);
});

test("expiry is inclusive and revocation overrides future expiry", () => {
  const now = "2026-10-20T12:00:00Z";
  assert.equal(invitationStatus({ expires_at: "2026-10-20T12:00:01Z", revoked_at: null }, now), "Active");
  assert.equal(invitationStatus({ expires_at: now, revoked_at: null }, now), "Expired");
  assert.equal(invitationStatus({ expires_at: "2026-10-20T11:59:59Z", revoked_at: null }, now), "Expired");
  assert.equal(invitationStatus({ expires_at: "2026-10-22T12:00:00Z", revoked_at: now }, now), "Revoked");
  assert.match(formatInvitationTime("2026-10-20T23:45:00Z"), /23:45/);
  assert.match(formatInvitationTime("2026-10-20T23:45:00Z"), /UTC/);
});
