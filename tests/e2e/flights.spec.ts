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
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Flight tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});
async function traveler(name = "Flight Traveler") {
  const email = `triply-flight-e2e-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) throw new Error("Unable to create local flight traveler.");
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function fixture(ownerId: string, origin = "BCN", destination = "LIS", date = "2028-12-22") {
  const [{ id: tripId }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${ownerId}, 'Flights with friends', ${date}, ${date}) returning id`;
  const [{ id: legId }] = await db`insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
    values (${tripId}, ${origin}, ${destination}, ${date}, 0) returning id`;
  const path = `/trips/${tripId}/legs/${legId}`;
  return { tripId: tripId as string, legId: legId as string, path, manual: `${path}/proposals/new/manual` };
}
async function login(page: Page, user: Awaited<ReturnType<typeof traveler>>, path: string) {
  await page.context().clearCookies();
  await page.goto(`/login?${new URLSearchParams({ next: path })}`);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${path}`);
}
async function fill(page: Page, airline = "Vueling", departure = "09:30", arrival = "10:25") {
  await page.getByLabel("Airline", { exact: true }).fill(airline);
  await page.getByLabel("Departure time (24-hour)", { exact: true }).fill(departure);
  await page.getByLabel("Arrival time (24-hour)", { exact: true }).fill(arrival);
}

test("two members propose flights, compare shared cards, and open full proposal details", async ({ page, browser }) => {
  const owner = await traveler("Alex Organizer");
  const friend = await traveler("Sam Friend");
  const f = await fixture(owner.id);
  await db`insert into public.trip_members (trip_id, user_id) values (${f.tripId}, ${friend.id})`;
  await login(page, owner, f.path);
  await page.getByRole("link", { name: "+ Propose option", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add a flight", exact: true })).toBeVisible();
  await expect(page.getByText("Coming soon", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: "test-results/flights-methods-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: "Continue →", exact: true }).click();
  await expect(page.getByLabel("Origin airport", { exact: true })).toHaveValue("BCN");
  await expect(page.getByLabel("Departure time zone", { exact: true })).toHaveValue("Europe/Madrid");
  await expect(page.getByLabel("Departure time zone", { exact: true })).toHaveAttribute("readonly", "");
  await fill(page);
  await page.getByLabel("Flight number (optional)", { exact: true }).fill("vy123");
  await page.getByLabel("Price per person (optional)", { exact: true }).fill("89");
  await page.getByLabel("Currency", { exact: true }).fill("eur");
  await page.getByLabel("Booking URL (optional)", { exact: true }).fill("https://airline.example/flight?q=BCN-LIS");
  await page.getByLabel("Notes (optional)", { exact: true }).fill("Bring a cabin bag.\nCompare baggage fees.");
  await page.getByRole("form", { name: "Propose flight", exact: true }).evaluate((form, userId) => {
    for (const [name, value] of Object.entries({ proposer_id: userId, trip_id: "forged", trip_leg_id: "forged" })) {
      const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input);
    }
  }, friend.id);
  await page.screenshot({ path: "test-results/flights-manual-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${f.path}`);
  const list = page.getByRole("list", { name: "Flight proposals", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Vueling · VY123");
  await expect(list).toContainText("EUR 89.00");
  await expect(list).toContainText("Alex Organizer");
  const [saved] = await db`select id, proposer_id, departure_at, arrival_at, departure_timezone, notes from public.flight_proposals where trip_leg_id = ${f.legId}`;
  expect(saved.proposer_id).toBe(owner.id);
  expect(saved.departure_at.toISOString()).toBe("2028-12-22T08:30:00.000Z");
  expect(saved.arrival_at.toISOString()).toBe("2028-12-22T10:25:00.000Z");
  await list.getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Vueling flight details", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open booking link ↗", exact: true })).toHaveAttribute("href", "https://airline.example/flight?q=BCN-LIS");
  await expect(page.getByRole("link", { name: "Open booking link ↗", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText("Bring a cabin bag. Compare baggage fees.", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/flights-details-mobile.png", fullPage: true, caret: "initial" });
  const friendContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const recipient = await friendContext.newPage();
    await login(recipient, friend, f.path);
    await expect(recipient.getByRole("list", { name: "Flight proposals", exact: true })).toContainText("Vueling · VY123");
    await recipient.goto(f.manual);
    await fill(recipient, "A second airline", "12:00", "13:00");
    await recipient.getByRole("button", { name: "Propose flight →", exact: true }).click();
    await expect(recipient.getByRole("list", { name: "Flight proposals", exact: true }).getByRole("listitem")).toHaveCount(2);
    const [optional] = await db`select price, notes, booking_url, flight_number from public.flight_proposals where trip_leg_id = ${f.legId} and proposer_id = ${friend.id}`;
    expect(optional).toEqual({ price: null, notes: null, booking_url: null, flight_number: null });
    await db`insert into public.flight_votes (trip_id, trip_leg_id, proposal_id, user_id) values (${f.tripId}, ${f.legId}, ${saved.id}, ${friend.id})`;
    await page.goto(f.path);
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").first()).toContainText("1 interested");
    await expect(list).toContainText("Sam Friend");
  } finally { await friendContext.close(); }
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto(f.path);
    await expect(desktop.getByRole("list", { name: "Flight proposals", exact: true }).getByRole("listitem")).toHaveCount(2);
    await desktop.screenshot({ path: "test-results/flights-list-desktop.png", fullPage: true, caret: "initial" });
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  } finally { await desktopContext.close(); }
  await page.goto(`/trips/${f.tripId}`);
  await expect(page.getByRole("list", { name: "Travel legs", exact: true })).toContainText("2 flight options");
  await expect(page.getByText("Decision pending", { exact: true })).toBeVisible();
});

test("validation and failed writes preserve the form, and cancel saves nothing", async ({ page }) => {
  const owner = await traveler();
  const f = await fixture(owner.id);
  await login(page, owner, f.manual);
  await page.getByRole("form", { name: "Propose flight", exact: true }).evaluate(form => form.setAttribute("novalidate", ""));
  await fill(page, " ");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByLabel("Airline", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Airline", { exact: true })).toBeFocused();
  await fill(page, "Keep my airline", "09:30", "08:00");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByLabel("Arrival time (24-hour)", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await fill(page, "Keep my airline");
  await page.getByLabel("Booking URL (optional)", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByLabel("Booking URL (optional)", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Booking URL (optional)", { exact: true }).fill("");
  try {
    await db`revoke insert (trip_id, trip_leg_id, airline, flight_number, origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency, booking_url, notes) on public.flight_proposals from authenticated`;
    await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
    await expect(page.getByRole("form", { name: "Propose flight", exact: true }).getByRole("alert")).toContainText("We couldn't save this flight proposal.");
    await expect(page.getByLabel("Airline", { exact: true })).toHaveValue("Keep my airline");
    await expect(page.getByLabel("Departure time (24-hour)", { exact: true })).toHaveValue("09:30");
  } finally {
    await db`grant insert (trip_id, trip_leg_id, airline, flight_number, origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency, booking_url, notes) on public.flight_proposals to authenticated`;
  }
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${f.path}`);
  const [{ count }] = await db`select count(*)::int as count from public.flight_proposals where trip_leg_id = ${f.legId}`;
  expect(count).toBe(0);
});

test("uncatalogued airports require named zones and repeated clock times require a choice", async ({ page }) => {
  const owner = await traveler();
  const unknown = await fixture(owner.id, "HND", "LAX");
  await login(page, owner, unknown.manual);
  await fill(page, "Across the date line", "17:00", "10:00");
  await page.getByLabel("Departure time zone", { exact: true }).fill("Asia/Tokyo");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByRole("list", { name: "Flight proposals", exact: true })).toContainText("17:00");
  const repeated = await fixture(owner.id, "JFK", "LAX", "2025-11-02");
  await page.goto(repeated.manual);
  await fill(page, "Clock change flight", "01:30", "09:00");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByLabel("Departure clock occurrence", { exact: true })).toBeVisible();
  await page.getByLabel("Departure clock occurrence", { exact: true }).selectOption("later");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${repeated.path}`);
  const [saved] = await db`select departure_at from public.flight_proposals where trip_leg_id = ${repeated.legId}`;
  expect(saved.departure_at.toISOString()).toBe("2025-11-02T06:30:00.000Z");
});

test("a concurrent selection closes a pending proposal and prevents a duplicate save", async ({ page }) => {
  const owner = await traveler();
  const f = await fixture(owner.id);
  const [{ id: candidate }] = await db`insert into public.flight_proposals (trip_id, trip_leg_id, proposer_id, airline, origin_airport, destination_airport,
    departure_at, arrival_at, departure_timezone, arrival_timezone) values (${f.tripId}, ${f.legId}, ${owner.id}, 'Selected candidate', 'BCN', 'LIS',
    '2028-12-22T08:00:00Z', '2028-12-22T10:00:00Z', 'Europe/Madrid', 'Europe/Lisbon') returning id`;
  await login(page, owner, f.manual);
  await fill(page);
  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    await connection`select id from public.trip_legs where id = ${f.legId} for update`;
    await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saving proposal…", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Airline", { exact: true })).toBeDisabled();
    // Wait for the insert's database guard before committing selection.
    await expect.poll(async () => {
      const [{ waiting }] = await db`select exists(select 1 from pg_stat_activity where query like '%flight_proposals%' and wait_event_type = 'Lock') as waiting`;
      return waiting;
    }).toBe(true);
    await connection`update public.trip_legs set selected_proposal_id = ${candidate} where id = ${f.legId}`;
    await connection`commit`;
    await expect(page.getByRole("form", { name: "Propose flight", exact: true }).getByRole("alert")).toContainText("a flight was selected");
  } finally {
    await connection`rollback`; connection.release(); await lock.end();
  }
  const [{ count }] = await db`select count(*)::int as count from public.flight_proposals where trip_leg_id = ${f.legId}`;
  expect(count).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Proposals are closed", exact: true })).toBeVisible();
  await page.goto(f.path);
  await expect(page.getByRole("link", { name: "+ Propose option", exact: true })).toHaveCount(0);
});

test("proposal routes and submissions enforce membership and trip/leg boundaries", async ({ page }) => {
  const owner = await traveler();
  const friend = await traveler();
  const outsider = await traveler();
  const f = await fixture(owner.id);
  await db`insert into public.trip_members (trip_id, user_id) values (${f.tripId}, ${friend.id})`;
  await login(page, friend, f.manual);
  await fill(page, "Member proposal");
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByRole("list", { name: "Flight proposals", exact: true })).toContainText("Member proposal");
  const [{ id }] = await db`select id from public.flight_proposals where trip_leg_id = ${f.legId}`;
  const other = await fixture(owner.id);
  for (const path of [`${f.path}/proposals/${randomUUID()}`, `${other.path}/proposals/${id}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Proposal unavailable", exact: true })).toBeVisible();
  }
  await page.goto(f.manual);
  await fill(page);
  await db`delete from public.trip_members where trip_id = ${f.tripId} and user_id = ${friend.id}`;
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByRole("form", { name: "Propose flight", exact: true }).getByRole("alert")).toContainText("no longer a member");
  await login(page, outsider, `${f.path}/proposals/${id}`);
  await expect(page.getByRole("heading", { name: "Proposal unavailable", exact: true })).toBeVisible();
  await login(page, owner, f.manual);
  await fill(page);
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Propose flight →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(f.manual);
});

test("failed proposal reads offer recovery and the manual form fits narrow screens", async ({ page }) => {
  const owner = await traveler();
  const f = await fixture(owner.id);
  await login(page, owner, f.path);
  await expect(page.getByRole("heading", { name: "No flight proposals yet", exact: true })).toBeVisible();
  try {
    await db`revoke select on public.flight_votes from authenticated`;
    await page.reload();
    await expect(page.locator("main").getByRole("alert")).toContainText("We couldn't load flight options.");
    await expect(page.getByRole("heading", { name: "No flight proposals yet", exact: true })).toHaveCount(0);
  } finally { await db`grant select on public.flight_votes to authenticated`; }
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No flight proposals yet", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(f.manual);
  await expect(page.getByRole("form", { name: "Propose flight", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
