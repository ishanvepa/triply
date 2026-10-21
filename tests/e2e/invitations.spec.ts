import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import type { Database } from "@/types/database.types";

const require = createRequire(`${process.cwd()}/package.json`);
const raw = JSON.parse(execFileSync(process.execPath, [require.resolve("supabase/dist/supabase.js"), "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const status = raw.data ?? raw;
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Invitation tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});

async function traveler(name: string) {
  const email = `triply-invite-e2e-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) throw new Error("Unable to create local invitation fixture.");
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function login(page: Page, user: Awaited<ReturnType<typeof traveler>>, path: string) {
  await page.context().clearCookies();
  await page.goto(`/login?${new URLSearchParams({ next: path })}`);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${path}`);
}
async function api(user: Awaited<ReturnType<typeof traveler>>) {
  const client = createClient<Database>(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error("Unable to sign in local invitation fixture.");
  return client;
}
async function trip(ownerId: string) {
  const [{ id }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${ownerId}, 'Friends in Europe', '2028-12-22', '2029-01-02') returning id`;
  return id as string;
}

test("organizer shares a link, another account joins, and revocation stops new members", async ({ page, browser, context }) => {
  const owner = await traveler("Alex Organizer");
  const friend = await traveler("Jamie Friend");
  const outsider = await traveler("Morgan Traveler");
  const tripId = await trip(owner.id);
  await login(page, owner, `/trips/${tripId}`);
  const members = page.getByRole("list", { name: "Group members" });
  await expect(members.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Create invitation link", exact: true }).click();
  const field = page.getByLabel("Invitation link", { exact: true });
  await expect(field).toHaveValue(/^http:\/\/127\.0\.0\.1:3100\/invite\/[0-9a-f]{64}$/);
  const link = await field.inputValue();
  const token = new URL(link).pathname.split("/").at(-1)!;
  const [record] = await db`select id, token_hash, expires_at, created_at from public.trip_invitations where trip_id = ${tripId}`;
  expect(record.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
  expect(record.token_hash).not.toBe(token);
  expect((new Date(record.expires_at).getTime() - new Date(record.created_at).getTime()) / 86400000).toBeCloseTo(7, 2);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
    (window as Window & { sharedLink?: string }).sharedLink = data.url;
  } }));
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Share options opened.");
  expect(await page.evaluate(() => (window as Window & { sharedLink?: string }).sharedLink)).toBe(link);
  // Clipboard denial still leaves a selected, manually copyable URL.
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw new Error("Clipboard denied"); } }));
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Select and copy");
  await expect(field).toBeFocused();
  await page.screenshot({ path: "test-results/invitations-organizer-mobile.png", fullPage: true, caret: "initial" });

  const friendContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  try {
    const recipient = await friendContext.newPage();
    await recipient.goto(link);
    expect(new URL(recipient.url()).searchParams.get("next")).toBe(`/invite/${token}`);
    await recipient.getByRole("link", { name: "Create an account", exact: true }).click();
    expect(new URL(recipient.url()).searchParams.get("next")).toBe(`/invite/${token}`);
    await recipient.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(recipient.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
    await recipient.getByLabel("Email address").fill(friend.email);
    await recipient.getByLabel("Password", { exact: true }).fill(friend.password);
    await recipient.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(recipient.getByRole("heading", { name: "Group invitations", exact: true })).toBeVisible();
    await expect(recipient.getByText("Friends in Europe", { exact: true })).toHaveCount(0);
    const [{ count: before }] = await db`select count(*)::int as count from public.trip_members where trip_id = ${tripId}`;
    expect(before).toBe(1);
    await recipient.screenshot({ path: "test-results/invitation-landing-mobile.png", fullPage: true, caret: "initial" });
    await recipient.getByRole("button", { name: "Join trip", exact: true }).click();
    await expect(recipient).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}`);
    await expect(recipient.getByRole("list", { name: "Group members" }).getByRole("listitem")).toHaveCount(2);
    await expect(recipient.getByRole("list", { name: "Group members" })).toContainText("Jamie Friend · You");
    await expect(recipient.getByRole("button", { name: "Create invitation link", exact: true })).toHaveCount(0);
    await recipient.goto(link);
    await recipient.getByRole("button", { name: "Join trip", exact: true }).click();
    await expect(recipient).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}`);
    const memberApi = await api(friend);
    const repeated = await Promise.all([memberApi.rpc("accept_trip_invitation", { p_token: token }), memberApi.rpc("accept_trip_invitation", { p_token: token })]);
    expect(repeated.every(result => !result.error && result.data === tripId)).toBe(true);
    const [{ count }] = await db`select count(*)::int as count from public.trip_members where trip_id = ${tripId} and user_id = ${friend.id}`;
    expect(count).toBe(1);
    const forbiddenCreate = await memberApi.rpc("create_trip_invitation", { p_trip_id: tripId });
    expect(forbiddenCreate.error?.code).toBe("42501");
    const forbiddenRevoke = await memberApi.from("trip_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", record.id).select("id");
    expect(forbiddenRevoke.data).toEqual([]);
    await page.reload();
    await expect(members.getByRole("listitem")).toHaveCount(2);
    await expect(members).toContainText("Jamie Friend");
    await page.getByRole("button", { name: "Revoke link", exact: true }).click();
    await expect(page.getByRole("list", { name: "Invitation links" })).toContainText("Revoked");
    await expect(page.getByLabel("Invitation link", { exact: true })).toHaveCount(0);
    const [revoked] = await db`select revoked_at from public.trip_invitations where id = ${record.id}`;
    expect(revoked.revoked_at).not.toBeNull();
    // Revoking a link does not remove travelers who have already joined.
    await recipient.reload();
    await expect(recipient.getByRole("heading", { name: "Friends in Europe", exact: true })).toBeVisible();
    await login(recipient, outsider, `/invite/${token}`);
    await recipient.getByRole("button", { name: "Join trip", exact: true }).click();
    await expect(recipient.locator("main").getByRole("alert")).toContainText("invalid, expired, or revoked");
    const [{ count: finalCount }] = await db`select count(*)::int as count from public.trip_members where trip_id = ${tripId}`;
    expect(finalCount).toBe(2);
  } finally { await friendContext.close(); }
});

test("expired, unknown, and malformed invitations cannot join a trip", async ({ page }) => {
  const owner = await traveler("Invitation Organizer");
  const recipient = await traveler("New Traveler");
  const tripId = await trip(owner.id);
  const ownerApi = await api(owner);
  const { data: invitation, error } = await ownerApi.rpc("create_trip_invitation", { p_trip_id: tripId }).single();
  expect(error).toBeNull();
  if (!invitation) throw new Error("Local invitation fixture missing.");
  await db`update public.trip_invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = ${invitation.invitation_id}`;
  await login(page, recipient, `/invite/${invitation.token}`);
  await page.getByRole("button", { name: "Join trip", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("invalid, expired, or revoked");
  await page.goto(`/invite/${"f".repeat(64)}`);
  await page.getByRole("button", { name: "Join trip", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("invalid, expired, or revoked");
  await page.goto("/invite/not-a-valid-token");
  await expect(page.getByRole("heading", { name: "Invitation unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join trip", exact: true })).toHaveCount(0);
  const [{ count }] = await db`select count(*)::int as count from public.trip_members where trip_id = ${tripId}`;
  expect(count).toBe(1);
  await login(page, owner, `/trips/${tripId}`);
  await expect(page.getByRole("list", { name: "Invitation links" })).toContainText("Expired");
  await expect(page.getByRole("button", { name: "Revoke link", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Create invitation link", exact: true }).click();
  const link = await page.getByLabel("Invitation link", { exact: true }).inputValue();
  expect(link).not.toContain(invitation.token);
  const freshToken = new URL(link).pathname.split("/").at(-1)!;
  await page.goto(`/invite/${freshToken}`);
  await page.getByRole("button", { name: "Join trip", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}`);
  const [{ role }] = await db`select role from public.trip_members where trip_id = ${tripId} and user_id = ${owner.id}`;
  expect(role).toBe("organizer");
});
