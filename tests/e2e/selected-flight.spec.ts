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
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Selected-flight tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});
async function traveler() {
  const email = `triply-selected-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Unable to create selected-flight fixture.");
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function fixture() {
  const owner = await traveler(), member = await traveler(), abstainer = await traveler();
  const [{ id: tripId }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${owner.id}, 'Selected flights with friends', '2028-12-22', '2028-12-22') returning id`;
  await db`insert into public.trip_members (trip_id, user_id) values (${tripId}, ${member.id}), (${tripId}, ${abstainer.id})`;
  const [{ id: legId }] = await db`insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
    values (${tripId}, 'BCN', 'LIS', '2028-12-22', 0) returning id`;
  const flights = await db`insert into public.flight_proposals (trip_id, trip_leg_id, proposer_id, airline, origin_airport, destination_airport,
    departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency)
    values (${tripId}, ${legId}, ${owner.id}, 'Vueling', 'BCN', 'LIS', '2028-12-22T08:30Z', '2028-12-22T10:25Z', 'Europe/Madrid', 'Europe/Lisbon', 89, 'EUR'),
    (${tripId}, ${legId}, ${member.id}, 'Ryanair', 'BCN', 'LIS', '2028-12-22T12:00Z', '2028-12-22T14:00Z', 'Europe/Madrid', 'Europe/Lisbon', 99, 'EUR') returning id`;
  const base = `/trips/${tripId}/legs/${legId}`;
  return { owner, member, abstainer, tripId: tripId as string, legId: legId as string, flights, base, path: `${base}/selected` };
}
async function login(page: Page, user: Awaited<ReturnType<typeof traveler>>, path: string) {
  await page.context().clearCookies();
  await page.goto(`/login?${new URLSearchParams({ next: path })}`);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${path}`);

}

async function selectFlight(f: Awaited<ReturnType<typeof fixture>>, url: string | null = "https://airline.example/search?from=BCN&to=LIS") {
  await db`update public.flight_proposals set flight_number = 'VY123', booking_url = ${url} where id = ${f.flights[0].id}`;
  await db`update public.trip_legs set selected_proposal_id = ${f.flights[0].id} where id = ${f.legId}`;
}

test("selected leg opens the shared ticket, safe external booking link, and actual group progress", async ({ page, browser }) => {
  const f = await fixture();
  await selectFlight(f);
  await db`insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, user_id, status)
    values (${f.tripId}, ${f.legId}, ${f.flights[0].id}, ${f.owner.id}, 'booked'),
    (${f.tripId}, ${f.legId}, ${f.flights[0].id}, ${f.abstainer.id}, 'not_joining')`;
  await login(page, f.member, `/trips/${f.tripId}`);
  await page.getByRole("list", { name: "Travel legs", exact: true }).getByRole("link").first().click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${f.path}`);
  await expect(page.getByRole("heading", { name: "Selected flight", exact: true })).toBeVisible();
  const ticket = page.getByRole("region", { name: "Selected flight details", exact: true });
  await expect(ticket.getByRole("heading", { name: "Vueling · VY123", exact: true })).toBeVisible();
  for (const text of ['Barcelona (BCN)', 'Lisbon (LIS)', '09:30', '10:25', 'Dec 22, 2028', 'Europe/Madrid', 'Europe/Lisbon', 'EUR 89.00 per person']) {
    await expect(ticket).toContainText(text);
  }
  await expect(page.getByText("1 of 2 travelers booked", { exact: true })).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "Group booking progress", exact: true });
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(progress).toHaveAttribute("aria-valuemax", "2");
  await expect(page.getByText("1 not joining · Excluded from booking progress", { exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: "Book on airline site ↗", exact: true });
  await expect(link).toHaveAttribute("href", "https://airline.example/search?from=BCN&to=LIS");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText(/The proposed price and seat availability are not guaranteed/)).toBeVisible();
  await expect(page.getByText(/triply has not verified these purchases/)).toBeVisible();
  await page.context().route("https://airline.example/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Local booking destination fixture</h1>" }));
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Local booking destination fixture", exact: true })).toBeVisible();
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${f.path}`);
  expect(await db`select * from public.flight_bookings where trip_leg_id = ${f.legId}`).toHaveLength(2);
  await page.screenshot({ path: "test-results/selected-flight-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto(f.path);
    await expect(desktop.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
    await desktop.screenshot({ path: "test-results/selected-flight-desktop.png", fullPage: true });
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  } finally { await desktopContext.close(); }
  await page.getByRole("link", { name: "View all proposals →", exact: true }).click();
  await page.getByRole("link", { name: "View selected flight →", exact: true }).click();
  await page.getByRole("link", { name: "View group decision →", exact: true }).click();
  await page.getByRole("link", { name: "View selected flight →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Selected flight", exact: true })).toBeVisible();
});

test("missing price/link, unsafe stored links, opt-outs, and narrow layouts have honest states", async ({ page }) => {
  const f = await fixture();
  await db`update public.flight_proposals set airline = ${'Long airline name '.repeat(6)}, price = null, flight_number = null where id = ${f.flights[0].id}`;
  await selectFlight(f, null);
  await page.setViewportSize({ width: 320, height: 740 });
  await login(page, f.owner, f.path);
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await expect(page.getByText("0 of 3 travelers booked", { exact: true })).toBeVisible();
  await expect(page.getByText(/No booking link provided/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Book on airline site ↗", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await db`insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, user_id, status)
    values (${f.tripId}, ${f.legId}, ${f.flights[0].id}, ${f.owner.id}, 'not_joining'),
    (${f.tripId}, ${f.legId}, ${f.flights[0].id}, ${f.member.id}, 'not_joining'),
    (${f.tripId}, ${f.legId}, ${f.flights[0].id}, ${f.abstainer.id}, 'not_joining')`;
  await page.reload();
  await expect(page.getByText("No participating travelers", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
  await expect(page.getByText("3 not joining · Excluded from booking progress", { exact: true })).toBeVisible();
  // Simulate a legacy credential-bearing URL without bypassing any constraints.
  // Changes to selected proposals normally stay locked, so test a separate leg.
  const legacy = await fixture();
  await selectFlight(legacy, "https://username:password@airline.example/search");
  await login(page, legacy.owner, legacy.path);
  await expect(page.getByText(/No booking link provided/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Book on airline site ↗", exact: true })).toHaveCount(0);
});

test("no selection, mismatched legs, outsiders, removed membership, and login return are protected", async ({ page }) => {
  const f = await fixture();
  await login(page, f.member, f.path);
  await expect(page.getByRole("heading", { name: "No flight selected", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("link", { name: "View group decision →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Group decision", exact: true })).toBeVisible();
  await selectFlight(f);
  const other = await fixture();
  for (const path of [`/trips/${f.tripId}/legs/${other.legId}/selected`, `/trips/${f.tripId}/legs/invalid/selected`, other.path]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  }
  await page.goto(f.path);
  await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
  await db`delete from public.trip_members where trip_id = ${f.tripId} and user_id = ${f.member.id}`;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
  await page.context().clearCookies();
  await page.goto(f.path);
  await expect(page).toHaveURL(new RegExp('/login\\?next='));
  expect(new URL(page.url()).searchParams.get('next')).toBe(f.path);
  await page.getByLabel("Email address").fill(f.owner.email);
  await page.getByLabel("Password", { exact: true }).fill(f.owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${f.path}`);
  await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
});

test("failed reads offer retry and slow reads show the selected-flight loading state", async ({ page }) => {
  const f = await fixture();
  await selectFlight(f);
  await login(page, f.owner, f.path);
  await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
  for (const table of ['flight_bookings', 'flight_proposals']) {
    try {
      await db`revoke select on ${db(table)} from authenticated`;
      await page.reload();
      await expect(page.getByRole("heading", { name: "Selected flight unavailable", exact: true })).toBeVisible();
      await expect(page.getByRole("progressbar")).toHaveCount(0);
    } finally { await db`grant select on ${db(table)} to authenticated`; }
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
  }
  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    await connection`lock table public.flight_bookings in access exclusive mode`;
    await page.goto(f.path, { waitUntil: 'commit' });
    await expect(page.getByRole("status")).toContainText("Loading selected flight…");
    await connection`commit`;
    await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toBeVisible();
  } finally {
    await connection`rollback`;
    connection.release();
    await lock.end();
  }
});
