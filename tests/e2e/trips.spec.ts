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

test.afterAll(async () => {
  // Delete only fixtures created by this file, in FK order.
  // Includes trips created through the UI, even if a test fails before redirect.
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
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
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
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

test("trip creation validates on the server and makes the creator the organizer", async ({ page, browser }) => {
  const user = await traveler();
  const other = await traveler();
  await login(page, user);
  await page.getByRole("link", { name: "+ New trip", exact: true }).click();
  const form = page.getByRole("form", { name: "Create trip", exact: true });
  await expect(form).toBeVisible();
  // Bypass browser constraints to verify the server rather than native validation.
  await form.evaluate((element: HTMLFormElement) => { element.noValidate = true; });
  await page.getByLabel("Trip name", { exact: true }).fill("   ");
  await page.getByLabel("Start date", { exact: true }).fill("2028-03-02");
  await page.getByLabel("End date", { exact: true }).fill("2028-02-29");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Keep these plans.");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.getByText("Enter a trip name with 1–120 characters.")).toBeVisible();
  await expect(page.getByText("End date must be on or after the start date.")).toBeVisible();
  await expect(page.getByLabel("Trip name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Description (optional)", { exact: true })).toHaveValue("Keep these plans.");

  await page.getByLabel("Trip name", { exact: true }).fill("  Spring escape  ");
  await page.getByLabel("Start date", { exact: true }).evaluate((input: HTMLInputElement) => { input.type = "text"; });
  await page.getByLabel("Start date", { exact: true }).fill("2027-02-29");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.getByText("Enter a valid start date.")).toBeVisible();
  const [{ count: invalidCount }] = await db`select count(*)::int as count from public.trips where created_by = ${user.id}`;
  expect(invalidCount).toBe(0);

  await page.getByLabel("Start date", { exact: true }).evaluate((input: HTMLInputElement) => { input.type = "date"; });
  await page.getByLabel("Start date", { exact: true }).fill("2028-02-29");
  await page.getByLabel("End date", { exact: true }).fill("2028-03-02");
  await page.getByLabel("Description (optional)", { exact: true }).fill("  A few days with friends.  ");
  await form.evaluate((element, otherId) => {
    for (const [name, value] of Object.entries({ created_by: otherId, user_id: otherId, role: "member" })) {
      const hidden = document.createElement("input"); hidden.type = "hidden"; hidden.name = name; hidden.value = value; element.append(hidden);
    }
  }, other.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: "test-results/create-trip-mobile.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: "Spring escape", exact: true })).toBeVisible();
  await expect(page.getByText("A few days with friends.", { exact: true })).toBeVisible();
  const [saved] = await db`select created_by, name, start_date::text, end_date::text, description from public.trips where id = ${id}`;
  expect(saved).toMatchObject({ created_by: user.id, name: "Spring escape", start_date: "2028-02-29", end_date: "2028-03-02", description: "A few days with friends." });
  const membership = await db`select user_id, role from public.trip_members where trip_id = ${id}`;
  expect(membership).toEqual([{ user_id: user.id, role: "organizer" }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Spring escape", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("list", { name: "Your trips" }).getByRole("heading", { name: "Spring escape", exact: true })).toBeVisible();

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, isMobile: false, deviceScaleFactor: 1, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto("/trips/new");
    await expect(desktop.getByLabel("Trip name", { exact: true })).toBeVisible();
    await desktop.screenshot({ path: "test-results/create-trip-desktop.png", fullPage: true, caret: "initial" });
  } finally { await desktopContext.close(); }

  // A one-day trip and omitted description are valid; cancel creates no record.
  await page.getByRole("link", { name: "+ New trip", exact: true }).click();
  await page.getByLabel("Trip name", { exact: true }).fill("One day away");
  await page.getByLabel("Start date", { exact: true }).fill("2028-04-01");
  await page.getByLabel("End date", { exact: true }).fill("2028-04-01");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One day away", exact: true })).toBeVisible();
  const [{ description }] = await db`select description from public.trips where created_by = ${user.id} and name = 'One day away'`;
  expect(description).toBeNull();
  await page.goto("/trips/new");
  await page.getByLabel("Trip name", { exact: true }).fill("Canceled plan");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/trips");
  const [{ count }] = await db`select count(*)::int as count from public.trips where created_by = ${user.id}`;
  expect(count).toBe(2);
});

test("failed creation preserves input and a pending save cannot be submitted again", async ({ page }) => {
  const user = await traveler();
  await login(page, user);
  await page.goto("/trips/new");
  await page.getByLabel("Trip name", { exact: true }).fill("Try this adventure again");
  await page.getByLabel("Start date", { exact: true }).fill("2028-05-01");
  await page.getByLabel("End date", { exact: true }).fill("2028-05-03");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Keep this description too.");
  try {
    await db`revoke insert (name, description, start_date, end_date) on public.trips from authenticated`;
    await page.getByRole("button", { name: "Create trip", exact: true }).click();
    await expect(page.getByRole("form", { name: "Create trip", exact: true }).getByRole("alert")).toContainText("We couldn't create your trip.");
    await expect(page.getByLabel("Trip name", { exact: true })).toHaveValue("Try this adventure again");
    await expect(page.getByLabel("Start date", { exact: true })).toHaveValue("2028-05-01");
    await expect(page.getByLabel("End date", { exact: true })).toHaveValue("2028-05-03");
    await expect(page.getByLabel("Description (optional)", { exact: true })).toHaveValue("Keep this description too.");
    const [{ count }] = await db`select count(*)::int as count from public.trips where created_by = ${user.id}`;
    expect(count).toBe(0);
  } finally {
    await db`grant insert (name, description, start_date, end_date) on public.trips to authenticated`;
  }
  const lock = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
  const connection = await lock.reserve();
  try {
    await connection`begin`;
    await connection`lock table public.trips in access exclusive mode`;
    await page.getByRole("button", { name: "Create trip", exact: true }).click();
    await expect(page.getByRole("button", { name: "Creating trip…", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Trip name", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await connection`commit`;
    await expect(page.getByRole("heading", { name: "Try this adventure again", exact: true })).toBeVisible();
    const [{ count }] = await db`select count(*)::int as count from public.trips where created_by = ${user.id}`;
    expect(count).toBe(1);
  } finally {
    await connection`rollback`;
    connection.release();
    await lock.end();
  }

  await page.goto("/trips/new");
  await page.getByLabel("Trip name", { exact: true }).fill("Signed out request");
  await page.getByLabel("Start date", { exact: true }).fill("2028-06-01");
  await page.getByLabel("End date", { exact: true }).fill("2028-06-02");
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  const [{ count }] = await db`select count(*)::int as count from public.trips where created_by = ${user.id}`;
  expect(count).toBe(1);
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
