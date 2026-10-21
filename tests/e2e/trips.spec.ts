import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// Test data and privileged setup are strictly local; never read .env.local.
const require = createRequire(`${process.cwd()}/package.json`);
const statusResult = JSON.parse(execFileSync(process.execPath, [require.resolve("supabase/dist/supabase.js"), "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const status = statusResult.data ?? statusResult;
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Trips tests require local Supabase.");
const auth = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
const trips: string[] = [];

test.afterAll(async () => {
  // Delete only fixtures created by this file, in FK order.
  for (const id of trips) await db`delete from public.trips where id = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});

async function traveler() {
  const email = `triply-trips-e2e-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Unable to create local test traveler.");
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function login(page: Page, user: Awaited<ReturnType<typeof traveler>>) {
  await page.goto("/login?next=/trips");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/trips");
}

async function trip(owner: string, name: string, start: string, end: string) {
  const [{ id }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${owner}, ${name}, ${start}, ${end}) returning id`;
  trips.push(id);
  return id as string;
}

test("empty state, membership-only trips, date statuses, and protected destinations", async ({ page, browser }, testInfo) => {
  const member = await traveler();
  const organizer = await traveler();
  const outsider = await traveler();
  const privateTrip = await trip(outsider.id, "Private trip must stay private", "2099-06-01", "2099-06-03");
  await login(page, member);
  await expect(page.getByRole("heading", { name: "Your trips", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No trips yet." })).toBeVisible();
  await expect(page.getByText("Create your first trip and start planning together.")).toBeVisible();
  await page.screenshot({ path: "test-results/trips-empty-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: "+ New trip", exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/new$/);
  await expect(page.getByRole("heading", { name: "New trip", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to trips", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/trips");
  await expect(page.getByRole("heading", { name: "No trips yet." })).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  const pastId = await trip(member.id, "Past summer trip", "2000-07-01", "2000-07-04");
  const currentId = await trip(organizer.id, "Traveling today", today, today);
  const futureId = await trip(organizer.id, "Europe winter trip", "2099-12-22", "2100-01-02");
  const longId = await trip(member.id, "Long".repeat(30), "2101-01-02", "2101-01-02");
  for (const id of [currentId, futureId]) await db`insert into public.trip_members (trip_id, user_id) values (${id}, ${member.id})`;
  await page.reload();
  const list = page.getByRole("list", { name: "Your trips" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByRole("heading")).toHaveText(["Past summer trip", "Traveling today", "Europe winter trip", "Long".repeat(30)]);
  await expect(list.getByRole("link").filter({ hasText: "Past summer trip" })).toContainText("Past");
  await expect(list.getByRole("link").filter({ hasText: "Traveling today" })).toContainText("In progress");
  const future = list.getByRole("link").filter({ hasText: "Europe winter trip" });
  await expect(future).toContainText("Upcoming");
  await expect(future).toContainText("Dec 22, 2099");
  await expect(future).toContainText("Jan 2, 2100");
  await expect(page.getByText("Private trip must stay private")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No trips yet." })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Trips", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: "test-results/trips-list-mobile.png", fullPage: true, caret: "initial" });
  await future.click();
  await expect(page).toHaveURL(new RegExp(`/trips/${futureId}$`));
  await expect(page.getByRole("heading", { name: "Europe winter trip", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Go back" }).click();
  await expect(list).toBeVisible();

  // A valid UUID belonging to another group must be indistinguishable from a missing trip.
  for (const id of [privateTrip, randomUUID(), "invalid-uuid"]) {
    await page.goto(`/trips/${id}`);
    await expect(page.getByRole("heading", { name: "Trip unavailable" })).toBeVisible();
    await expect(page.getByText("Private trip must stay private")).toHaveCount(0);
  }
  await page.goto(`/trips/${longId}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  // Membership removal must take effect on the next request, even for a previously opened trip.
  await db`delete from public.trip_members where trip_id = ${futureId} and user_id = ${member.id}`;
  await page.goto(`/trips/${futureId}`);
  await expect(page.getByRole("heading", { name: "Trip unavailable" })).toBeVisible();
  await page.goto("/trips");
  await expect(page.getByRole("list", { name: "Your trips" }).getByRole("listitem")).toHaveCount(3);
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto("/trips");
    await expect(desktop.getByRole("list", { name: "Your trips" }).getByRole("listitem")).toHaveCount(3);
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    await desktop.screenshot({ path: "test-results/trips-list-desktop.png", fullPage: true, caret: "initial" });
  } finally {
    await desktopContext.close();
  }

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  for (const path of ["/trips", "/trips/new", `/trips/${pastId}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  }
  testInfo.annotations.push({ type: "isolation", description: "Local fixtures only; no hosted data or real email." });
});

test("slow trip queries show loading and failed queries offer recovery", async ({ page }) => {
  const user = await traveler();
  await trip(user.id, "A trip to recover", "2099-01-01", "2099-01-02");
  await login(page, user);
  await expect(page.getByRole("list", { name: "Your trips" })).toBeVisible();

  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    await connection`lock table public.trips in access exclusive mode`;
    await page.goto("/trips", { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText("Loading your trips…");
    await connection`commit`;
    await expect(page.getByRole("list", { name: "Your trips" })).toBeVisible();
  } finally {
    await connection`rollback`;
    connection.release();
    await lock.end();
  }

  // Reversible local-only permission failure, restored even if the assertion fails.
  try {
    await db`revoke select on public.trips from authenticated`;
    await page.reload();
    await expect(page.locator("main").getByRole("alert")).toContainText("We couldn't load your trips.");
    await expect(page.getByRole("heading", { name: "No trips yet." })).toHaveCount(0);
  } finally {
    await db`grant select on public.trips to authenticated`;
  }
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("list", { name: "Your trips" })).toBeVisible();
});
