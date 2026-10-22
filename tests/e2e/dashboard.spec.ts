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
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Dashboard tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];

test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});

async function traveler(name = "Dashboard Traveler") {
  const email = `triply-dashboard-e2e-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) throw new Error("Unable to create local dashboard traveler.");
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

async function trip(owner: string, name = "Europe winter trip") {
  const [{ id }] = await db`insert into public.trips (created_by, name, description, start_date, end_date)
    values (${owner}, ${name}, 'A winter adventure with friends.', '2028-12-22', '2029-01-02') returning id`;
  return id as string;
}

async function populatedTrip() {
  const owner = await traveler("Alex Organizer");
  const friend = await traveler("Sam Friend");
  const optOut = await traveler("Jordan Opt-out");
  const quiet = await traveler("Taylor Undecided");
  const tripId = await trip(owner.id);
  for (const user of [friend, optOut, quiet]) {
    await db`insert into public.trip_members (trip_id, user_id) values (${tripId}, ${user.id})`;
  }
  const legs = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  // Deliberately insert out of order; positions, not insertion order, define the itinerary.
  await db`insert into public.trip_legs (id, trip_id, origin_airport, destination_airport, travel_date, position) values
    (${legs[2]}, ${tripId}, 'BER', 'KEF', '2028-12-26', 2),
    (${legs[0]}, ${tripId}, 'BCN', 'LIS', '2028-12-22', 0),
    (${legs[3]}, ${tripId}, 'KEF', 'ATL', '2028-12-28', 3),
    (${legs[1]}, ${tripId}, 'LIS', 'BER', '2028-12-24', 1)`;
  const proposals = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await db`insert into public.flight_proposals (id, trip_id, trip_leg_id, proposer_id, airline, flight_number,
    origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency) values
    (${proposals[0]}, ${tripId}, ${legs[0]}, ${owner.id}, 'TAP Air Portugal', 'TP 1041', 'BCN', 'LIS', '2028-12-22T09:00:00Z', '2028-12-22T11:00:00Z', 'Europe/Madrid', 'Europe/Lisbon', 120, 'EUR'),
    (${proposals[1]}, ${tripId}, ${legs[1]}, ${friend.id}, 'Group option one', null, 'LIS', 'BER', '2028-12-24T08:00:00Z', '2028-12-24T11:00:00Z', 'Europe/Lisbon', 'Europe/Berlin', 0, 'EUR'),
    (${proposals[2]}, ${tripId}, ${legs[1]}, ${owner.id}, 'Group option two', null, 'LIS', 'BER', '2028-12-24T13:00:00Z', '2028-12-24T16:00:00Z', 'Europe/Lisbon', 'Europe/Berlin', null, 'USD'),
    (${proposals[3]}, ${tripId}, ${legs[3]}, ${owner.id}, 'Selected home flight', null, 'KEF', 'ATL', '2028-12-28T12:00:00Z', '2028-12-28T20:00:00Z', 'Atlantic/Reykjavik', 'America/New_York', 500, 'USD')`;
  await db`update public.trip_legs set selected_proposal_id = ${proposals[0]} where id = ${legs[0]}`;
  await db`update public.trip_legs set selected_proposal_id = ${proposals[3]} where id = ${legs[3]}`;
  await db`insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, user_id, status) values
    (${tripId}, ${legs[0]}, ${proposals[0]}, ${owner.id}, 'booked'),
    (${tripId}, ${legs[0]}, ${proposals[0]}, ${friend.id}, 'planning_to_book'),
    (${tripId}, ${legs[0]}, ${proposals[0]}, ${optOut.id}, 'not_joining')`;
  return { owner, friend, optOut, quiet, tripId, legs, proposals };
}

test("dashboard shows real ordered legs, all statuses, progress, and working proposal navigation", async ({ page, browser }) => {
  const fixture = await populatedTrip();
  const { owner, tripId, legs } = fixture;
  await login(page, owner, `/trips/${tripId}`);
  await expect(page.getByRole("heading", { name: "Europe winter trip", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Trip summary" })).toContainText("2028");
  await expect(page.getByRole("region", { name: "Trip summary" })).toContainText("2029");
  await expect(page.getByLabel("Destinations", { exact: true })).toContainText("Lisbon (LIS) · 🇩🇪 Berlin (BER) · KEF · 🇺🇸 Atlanta (ATL)");
  await expect(page.getByRole("link", { name: "4 travelers", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Planning progress", exact: true })).toHaveAttribute("aria-valuenow", "2");
  await expect(page.getByRole("progressbar", { name: "Planning progress", exact: true })).toHaveAttribute("aria-valuemax", "4");
  await expect(page.getByRole("progressbar", { name: "Booking progress", exact: true })).toHaveAttribute("aria-valuetext", "1 of 7 traveler bookings complete");
  const list = page.getByRole("list", { name: "Travel legs", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  for (const [index, route] of ["Barcelona (BCN) to Lisbon (LIS)", "Lisbon (LIS) to Berlin (BER)", "Berlin (BER) to KEF", "KEF to Atlanta (ATL)"].entries()) {
    await expect(list.getByRole("heading").nth(index)).toHaveAccessibleName(route);
  }
  for (const label of ["Booking underway", "Decision pending", "Needs options", "Flight selected"]) {
    await expect(list.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(list.getByRole("listitem").first()).toContainText("1 of 3 travelers booked · 1 not joining");
  await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true, caret: "initial" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto(`/trips/${tripId}`);
    await expect(desktop.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(4);
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    await desktop.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true, caret: "initial" });
  } finally { await desktopContext.close(); }

  // The whole card is a keyboard-accessible link to a real member-only page.
  await list.getByRole("link").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`http://127.0.0.1:3100/trips/${tripId}/legs/${legs[0]}/selected`);
  await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toContainText("TAP Air Portugal · TP 1041");
  await expect(page.getByRole("heading", { name: "Selected flight", exact: true })).toBeVisible();
  await expect(page.getByText("10:00", { exact: true })).toBeVisible();
  await expect(page.getByText("Europe/Madrid", { exact: true })).toBeVisible();
  await expect(page.getByText("EUR 120.00 per person", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-proposals-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: "Go back", exact: true }).click();
  await page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("link").nth(1).click();
  await expect(page.getByRole("list", { name: "Flight proposals", exact: true }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("EUR 0.00", { exact: true })).toBeVisible();
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await page.goto(`/trips/${tripId}/legs/${legs[2]}`);
  await expect(page.getByRole("heading", { name: "No flight proposals yet", exact: true })).toBeVisible();

  await login(page, fixture.friend, `/trips/${tripId}`);
  await expect(page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Invite friends +", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create invitation link", exact: true })).toHaveCount(0);
});

test("empty trips show honest zero states and tolerate long names on small screens", async ({ page }) => {
  const owner = await traveler();
  const tripId = await trip(owner.id, "Long".repeat(30));
  await page.setViewportSize({ width: 320, height: 740 });
  await login(page, owner, `/trips/${tripId}`);
  await expect(page.getByRole("heading", { name: "No travel legs yet", exact: true })).toBeVisible();
  await expect(page.getByText("Select a flight to start tracking bookings.", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Booking progress", exact: true })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByLabel("Destinations", { exact: true })).toContainText("Destinations will appear");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/dashboard-empty-mobile.png", fullPage: true, caret: "initial" });
});

test("progress updates from stored reports, and all opt-outs never become a completed booking", async ({ page }) => {
  const { owner, friend, optOut, quiet, tripId, legs, proposals } = await populatedTrip();
  await login(page, owner, `/trips/${tripId}`);
  await db`update public.flight_bookings set status = 'booked' where trip_leg_id = ${legs[0]} and user_id = ${friend.id}`;
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Booking progress", exact: true })).toHaveAttribute("aria-valuetext", "2 of 7 traveler bookings complete");
  for (const user of [owner, friend, optOut, quiet]) {
    for (const [legId, proposalId] of [[legs[0], proposals[0]], [legs[3], proposals[3]]]) {
      await db`insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, user_id, status)
        values (${tripId}, ${legId}, ${proposalId}, ${user.id}, 'not_joining')
        on conflict (trip_leg_id, user_id) do update set status = 'not_joining'`;
    }
  }
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Booking progress", exact: true })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("No participating travelers on selected flights.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Travel legs", exact: true })).toContainText("4 not joining");
});

test("dashboard and proposal routes protect trip and leg boundaries and removed membership", async ({ page }) => {
  const { friend, tripId, legs } = await populatedTrip();
  const stranger = await traveler();
  const otherTrip = await trip(stranger.id, "Private group name");
  await login(page, stranger, `/trips/${tripId}`);
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  await page.goto(`/trips/${tripId}/legs/${legs[0]}`);
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  await page.goto(`/trips/${otherTrip}/legs/${legs[0]}`);
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  await expect(page.getByText("TAP Air Portugal · TP 1041", { exact: true })).toHaveCount(0);
  await login(page, friend, `/trips/${tripId}`);
  await expect(page.getByRole("list", { name: "Travel legs", exact: true })).toBeVisible();
  await db`delete from public.trip_members where trip_id = ${tripId} and user_id = ${friend.id}`;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  await page.context().clearCookies();
  const destination = `/trips/${tripId}/legs/${legs[0]}`;
  await page.goto(destination);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
});

test("planning query failures offer retry instead of false empty progress, and slow reads show loading", async ({ page }) => {
  const { owner, tripId } = await populatedTrip();
  await login(page, owner, `/trips/${tripId}`);
  for (const table of ["trip_legs", "flight_proposals", "flight_bookings"]) {
    try {
      await db`revoke select on ${db(table)} from authenticated`;
      await page.reload();
      await expect(page.locator("main").getByRole("alert")).toContainText("We couldn't load this trip's planning details.");
      await expect(page.getByRole("heading", { name: "No travel legs yet", exact: true })).toHaveCount(0);
    } finally {
      await db`grant select on ${db(table)} to authenticated`;
    }
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(4);
  }
  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    await connection`lock table public.trip_legs in access exclusive mode`;
    await page.goto(`/trips/${tripId}`, { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText("Loading trip planning…");
    await connection`commit`;
    await expect(page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("listitem")).toHaveCount(4);
  } finally {
    await connection`rollback`;
    connection.release();
    await lock.end();
  }
});
