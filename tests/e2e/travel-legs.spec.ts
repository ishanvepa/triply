import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import type { Database } from "@/types/database.types";

const require = createRequire(`${process.cwd()}/package.json`);
const raw = JSON.parse(execFileSync(process.execPath, [require.resolve("supabase/dist/supabase.js"), "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const status = raw.data ?? raw;
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Travel leg tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});

async function traveler() {
  const email = `triply-legs-e2e-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Unable to create local travel leg traveler.");
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
async function trip(ownerId: string) {
  const [{ id }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${ownerId}, 'An ordered adventure', '2028-12-22', '2029-01-02') returning id`;
  return id as string;
}
async function seededLeg(tripId: string, position = 0) {
  const [{ id }] = await db`insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
    values (${tripId}, 'BCN', 'LIS', '2028-12-22', ${position}) returning id`;
  return id as string;
}
async function proposal(tripId: string, legId: string, ownerId: string) {
  await db`insert into public.flight_proposals (trip_id, trip_leg_id, proposer_id, airline, origin_airport,
    destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone)
    values (${tripId}, ${legId}, ${ownerId}, 'A route to preserve', 'BCN', 'LIS',
      '2028-12-22T09:00:00Z', '2028-12-22T11:00:00Z', 'Europe/Madrid', 'Europe/Lisbon')`;
}
async function fillLeg(page: Page, origin = "BCN", destination = "LIS", date = "2028-12-22") {
  await page.getByLabel("Origin airport", { exact: true }).fill(origin);
  await page.getByLabel("Destination airport", { exact: true }).fill(destination);
  await page.getByLabel("Travel date", { exact: true }).fill(date);
}

test("organizer creates multiple legs, reorders, edits, and follows the same proposal links", async ({ page, browser }) => {
  const owner = await traveler();
  const tripId = await trip(owner.id);
  await login(page, owner, `/trips/${tripId}`);
  for (const [origin, destination, date] of [["bcn", "lis", "2028-12-22"], ["LIS", "BER", "2028-12-24"], ["BER", "ATL", "2028-12-28"]]) {
    await page.getByRole("link", { name: "+ Add travel leg", exact: true }).click();
    await expect(page.getByLabel("Travel date", { exact: true })).toHaveValue("2028-12-22");
    await fillLeg(page, origin, destination, date);
    await page.locator('form[aria-label="Add travel leg"]').evaluate(form => {
      for (const [name, value] of Object.entries({ trip_id: "forged-trip", position: "0", selected_proposal_id: "forged-selection" })) {
        const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input);
      }
    });
    await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}`);
  }
  const records = await db`select id, origin_airport, destination_airport, travel_date::text, position, selected_proposal_id
    from public.trip_legs where trip_id = ${tripId} order by position`;
  expect(records.map(record => record.position)).toEqual([0, 1, 2]);
  expect(records[0].origin_airport).toBe("BCN");
  expect(records[0].destination_airport).toBe("LIS");
  expect(records[0].selected_proposal_id).toBeNull();
  const list = page.getByRole("list", { name: "Travel legs", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Move leg 1 up", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move leg 3 down", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
  await expect(list.getByRole("heading").first()).toHaveAccessibleName("Lisbon (LIS) to Berlin (BER)");
  await expect(list.getByRole("link").nth(1)).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Travel leg moved");
  await page.reload();
  await expect(list.getByRole("heading").first()).toHaveAccessibleName("Lisbon (LIS) to Berlin (BER)");
  await page.getByRole("button", { name: "Move leg 3 up", exact: true }).click();
  await expect(list.getByRole("heading").nth(1)).toHaveAccessibleName("Berlin (BER) to Atlanta (ATL)");
  await list.getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "No flight proposals yet", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit leg", exact: true }).click();
  await expect(page.getByLabel("Origin airport", { exact: true })).toHaveValue("LIS");
  await fillLeg(page, "LIS", "KEF", "2029-01-01");
  await page.screenshot({ path: "test-results/travel-leg-edit-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}/legs/${records[1].id}`);
  await expect(page.getByRole("heading", { name: "Lisbon (LIS) → KEF", exact: true })).toBeVisible();
  const [edited] = await db`select destination_airport, travel_date::text, position from public.trip_legs where id = ${records[1].id}`;
  expect(edited).toEqual({ destination_airport: "KEF", travel_date: "2029-01-01", position: 0 });
  await page.getByRole("link", { name: "Go back", exact: true }).click();
  await expect(list.getByRole("heading").first()).toHaveAccessibleName("Lisbon (LIS) to KEF");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: "test-results/travel-legs-ordered-mobile.png", fullPage: true, caret: "initial" });
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto(`/trips/${tripId}/legs/new`);
    await expect(desktop.getByRole("form", { name: "Add travel leg", exact: true })).toBeVisible();
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    await desktop.screenshot({ path: "test-results/travel-leg-new-desktop.png", fullPage: true, caret: "initial" });
  } finally { await desktopContext.close(); }
});

test("server validation, cancel, write failures, and signed-out submissions preserve expected behavior", async ({ page }) => {
  const owner = await traveler();
  const tripId = await trip(owner.id);
  const path = `/trips/${tripId}/legs/new`;
  await login(page, owner, path);
  await page.getByRole("form", { name: "Add travel leg", exact: true }).evaluate(form => form.setAttribute("novalidate", ""));
  await fillLeg(page, "B1N", "LIS");
  await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
  await expect(page.getByLabel("Origin airport", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Origin airport", { exact: true })).toBeFocused();
  await fillLeg(page, "BCN", "BCN");
  await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
  await expect(page.getByText("Choose a different destination airport.", { exact: true })).toBeVisible();
  await fillLeg(page);
  try {
    await db`revoke insert (trip_id, origin_airport, destination_airport, travel_date, position) on public.trip_legs from authenticated`;
    await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
    await expect(page.getByRole("form", { name: "Add travel leg", exact: true }).getByRole("alert")).toContainText("We couldn't add this travel leg.");
    await expect(page.getByLabel("Origin airport", { exact: true })).toHaveValue("BCN");
    await expect(page.getByLabel("Travel date", { exact: true })).toHaveValue("2028-12-22");
  } finally {
    await db`grant insert (trip_id, origin_airport, destination_airport, travel_date, position) on public.trip_legs to authenticated`;
  }
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}`);
  const [{ count }] = await db`select count(*)::int as count from public.trip_legs where trip_id = ${tripId}`;
  expect(count).toBe(0);
  await page.goto(path);
  await fillLeg(page);
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(path);
});

test("proposal locks and concurrent edits prevent stale changes without losing proposals", async ({ page, context }) => {
  const owner = await traveler();
  const tripId = await trip(owner.id);
  const legId = await seededLeg(tripId);
  const path = `/trips/${tripId}/legs/${legId}/edit`;
  await login(page, owner, path);
  const other = await context.newPage();
  try {
    await other.goto(path);
    await page.getByLabel("Destination airport", { exact: true }).fill("BER");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}/legs/${legId}`);
    await other.getByLabel("Destination airport", { exact: true }).fill("FCO");
    await other.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(other.getByRole("form", { name: "Edit travel leg", exact: true }).getByRole("alert")).toContainText("This leg changed");
    await expect(other.getByLabel("Destination airport", { exact: true })).toHaveValue("FCO");
    await db`update public.trip_legs set destination_airport = 'LIS' where id = ${legId}`;
    await other.reload();
    // A proposal submitted after the edit form opened is still protected by the database.
    await proposal(tripId, legId, owner.id);
    await other.getByLabel("Destination airport", { exact: true }).fill("BER");
    await other.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(other.getByRole("form", { name: "Edit travel leg", exact: true }).getByRole("alert")).toContainText("This leg has flight proposals");
    await other.reload();
    await expect(other.getByLabel("Destination airport", { exact: true })).toBeDisabled();
    await expect(other.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
    await other.getByRole("link", { name: "Back to proposals", exact: true }).click();
    await expect(other.getByRole("list", { name: "Flight proposals", exact: true })).toContainText("A route to preserve");
    await seededLeg(tripId, 1);
    await page.goto(`/trips/${tripId}`);
    await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Travel leg moved");
    const [{ position }] = await db`select position from public.trip_legs where id = ${legId}`;
    expect(position).toBe(1);
  } finally { await other.close(); }
});

test("stale reorders show the current itinerary, pending controls disable, and failed moves recover", async ({ page }) => {
  const owner = await traveler();
  const tripId = await trip(owner.id);
  const first = await seededLeg(tripId);
  const second = await seededLeg(tripId, 1);
  await login(page, owner, `/trips/${tripId}`);
  await expect(page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(2);
  await seededLeg(tripId, 2);
  await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("The itinerary changed");
  await expect(page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(3);
  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    // Lock only the trip row so the action can authenticate and display pending state.
    await connection`select id from public.trips where id = ${tripId} for update`;
    await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Moving travel leg…");
    await expect(page.getByRole("button", { name: "Move leg 2 up", exact: true })).toBeDisabled();
    await connection`commit`;
    await expect(page.getByRole("status")).toContainText("Travel leg moved");
  } finally {
    await connection`rollback`;
    connection.release();
    await lock.end();
  }
  const ids = (await db`select id from public.trip_legs where trip_id = ${tripId} order by position`).map(row => row.id);
  expect(ids.slice(0, 2)).toEqual([second, first]);
  try {
    await db`revoke execute on function public.reorder_trip_legs(uuid,uuid[],uuid[]) from authenticated`;
    await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("We couldn't move this travel leg.");
  } finally {
    await db`grant execute on function public.reorder_trip_legs(uuid,uuid[],uuid[]) to authenticated`;
  }
  await page.getByRole("button", { name: "Move leg 1 down", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Travel leg moved");
});

test("members and outsiders cannot manage legs through pages or existing action forms", async ({ page }) => {
  const owner = await traveler();
  const member = await traveler();
  const tripId = await trip(owner.id);
  const legId = await seededLeg(tripId);
  await seededLeg(tripId, 1);
  await db`insert into public.trip_members (trip_id, user_id) values (${tripId}, ${member.id})`;
  await login(page, member, `/trips/${tripId}`);
  await expect(page.getByRole("link", { name: "+ Add travel leg", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Move leg/ })).toHaveCount(0);
  for (const path of [`/trips/${tripId}/legs/new`, `/trips/${tripId}/legs/${legId}/edit`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  }
  await login(page, owner, `/trips/${tripId}/legs/new`);
  await fillLeg(page);
  // Replace only the session in this still-open organizer form, then submit it.
  const memberContext = await page.context().browser()!.newContext();
  try {
    const memberPage = await memberContext.newPage();
    await login(memberPage, member, `/trips/${tripId}`);
    await page.context().clearCookies();
    await page.context().addCookies(await memberContext.cookies());
    await page.getByRole("button", { name: "Add travel leg", exact: true }).click();
    await expect(page.getByRole("form", { name: "Add travel leg", exact: true }).getByRole("alert")).toContainText("Only trip organizers");
  } finally { await memberContext.close(); }
  const [{ count }] = await db`select count(*)::int as count from public.trip_legs where trip_id = ${tripId}`;
  expect(count).toBe(2);
  const outsider = await traveler();
  await login(page, outsider, `/trips/${tripId}/legs/${legId}/edit`);
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
});
