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
if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Voting tests require local Supabase.");
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await db`delete from public.trips where created_by = ${id}`;
  for (const id of users) await db`delete from auth.users where id = ${id}`;
  await db.end();
});
async function traveler() {
  const email = `triply-voting-${randomUUID()}@example.test`;
  const password = `Local test password ${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Unable to create voting fixture.");
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function fixture() {
  const owner = await traveler(), member = await traveler(), abstainer = await traveler();
  const [{ id: tripId }] = await db`insert into public.trips (created_by, name, start_date, end_date)
    values (${owner.id}, 'Voting with friends', '2028-12-22', '2028-12-22') returning id`;
  await db`insert into public.trip_members (trip_id, user_id) values (${tripId}, ${member.id}), (${tripId}, ${abstainer.id})`;
  const [{ id: legId }] = await db`insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
    values (${tripId}, 'BCN', 'LIS', '2028-12-22', 0) returning id`;
  const flights = await db`insert into public.flight_proposals (trip_id, trip_leg_id, proposer_id, airline, origin_airport, destination_airport,
    departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency)
    values (${tripId}, ${legId}, ${owner.id}, 'Vueling', 'BCN', 'LIS', '2028-12-22T08:30Z', '2028-12-22T10:25Z', 'Europe/Madrid', 'Europe/Lisbon', 89, 'EUR'),
    (${tripId}, ${legId}, ${member.id}, 'Ryanair', 'BCN', 'LIS', '2028-12-22T12:00Z', '2028-12-22T14:00Z', 'Europe/Madrid', 'Europe/Lisbon', 99, 'EUR') returning id`;
  const base = `/trips/${tripId}/legs/${legId}`;
  return { owner, member, abstainer, tripId: tripId as string, legId: legId as string, flights, base, path: `${base}/decision` };
}
async function login(page: Page, user: Awaited<ReturnType<typeof traveler>>, path: string) {
  await page.context().clearCookies();
  await page.goto(`/login?${new URLSearchParams({ next: path })}`);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${path}`);
  await expect(page.getByRole("heading", { name: "Group decision", exact: true })).toBeVisible();
}
function option(page: Page, airline: string) {
  return page.getByRole("list", { name: "Voting results", exact: true }).getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: airline, exact: true }) });
}

test("members change one vote, see ties and abstentions; organizer confirms a non-leading flight", async ({ page, browser }) => {
  const f = await fixture();
  await login(page, f.owner, f.path);
  await expect(page.getByText("0 of 3 votes cast · 3 undecided", { exact: true })).toBeVisible();
  await option(page, "Vueling").getByRole("button", { name: "Vote for this flight", exact: true }).click();
  await expect(option(page, "Vueling").getByText("33% support", { exact: true })).toBeVisible();
  const memberContext = await browser.newContext();
  try {
    const memberPage = await memberContext.newPage();
    await login(memberPage, f.member, f.path);
    await expect(memberPage.getByRole("button", { name: "Review decision →", exact: true })).toHaveCount(0);
    const voteForm = option(memberPage, "Ryanair").getByRole("form");
    await voteForm.evaluate((form, ownerId) => {
      for (const [name, value] of Object.entries({ user_id: ownerId, trip_id: 'forged', proposal_id: 'forged' })) {
        const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
      }
    }, f.owner.id);
    await voteForm.getByRole("button").click();
    await expect(memberPage.getByText("Tied for lead", { exact: true })).toHaveCount(2);
    await option(memberPage, "Vueling").getByRole("button", { name: "Change vote to this flight", exact: true }).click();
    await expect(option(memberPage, "Vueling").getByRole("button", { name: "Your vote", exact: true })).toBeDisabled();
    const votes = await db`select user_id, proposal_id from public.flight_votes where trip_leg_id = ${f.legId}`;
    expect(votes).toHaveLength(2);
    expect(votes.every(vote => vote.proposal_id === f.flights[0].id)).toBe(true);
    await page.reload();
    await expect(page.getByText("2 of 3 votes cast · 1 undecided", { exact: true })).toBeVisible();
    await expect(option(page, "Vueling").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
    await page.screenshot({ path: "test-results/voting-mobile.png", fullPage: true });
    await option(page, "Ryanair").getByRole("button", { name: "Review decision →", exact: true }).click();
    await option(page, "Ryanair").getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await db`select selected_proposal_id from public.trip_legs where id = ${f.legId}`)[0].selected_proposal_id).toBeNull();
    await option(page, "Ryanair").getByRole("button", { name: "Review decision →", exact: true }).click();
    await option(page, "Ryanair").getByRole("button", { name: "Confirm selection", exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:3100${f.base}/selected`);
    await expect(page.getByRole("heading", { name: "Selected flight", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected flight details", exact: true })).toContainText("Ryanair");
    expect((await db`select selected_proposal_id from public.trip_legs where id = ${f.legId}`)[0].selected_proposal_id).toBe(f.flights[1].id);
    await memberPage.reload();
    await expect(memberPage.getByText("The organizer selected Ryanair for this leg.", { exact: true })).toBeVisible();
    await expect(memberPage.getByRole("button", { name: /Vote for this flight|Change vote|Confirm selection/ })).toHaveCount(0);
    await page.goto(`/trips/${f.tripId}`);
    await expect(page.getByText("Flight selected", { exact: true }).first()).toBeVisible();
    await page.goto(f.base);
    await expect(page.getByText("Selected flight", { exact: true })).toBeVisible();
  } finally { await memberContext.close(); }
});

test("forged member selection is rejected and stale voting closes after another tab selects", async ({ page }) => {
  const f = await fixture();
  await login(page, f.member, f.path);
  const form = option(page, "Vueling").getByRole("form");
  await form.evaluate(form => {
    form.querySelector('button')!.setAttribute('value', 'select');
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'confirmed'; input.value = 'yes'; form.append(input);
  });
  await form.getByRole("button").click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Only the organizer can select a flight.");
  expect((await db`select selected_proposal_id from public.trip_legs where id = ${f.legId}`)[0].selected_proposal_id).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Group decision", exact: true })).toBeVisible();
  await db`update public.trip_legs set selected_proposal_id = ${f.flights[1].id} where id = ${f.legId}`;
  await option(page, "Vueling").getByRole("button", { name: "Vote for this flight", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("A flight has already been selected. Voting is closed.");
  expect(await db`select * from public.flight_votes where trip_leg_id = ${f.legId}`).toHaveLength(0);
});

test("stale confirmation cannot replace an existing selection or select a changed leg", async ({ page }) => {
  const f = await fixture();
  await login(page, f.owner, f.path);
  await option(page, "Vueling").getByRole("button", { name: "Review decision →", exact: true }).click();
  await db`update public.trip_legs set position = 1 where id = ${f.legId}`;
  await page.getByRole("button", { name: "Confirm selection", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This leg changed or a flight was selected. Review the latest decision.");
  expect((await db`select selected_proposal_id from public.trip_legs where id = ${f.legId}`)[0].selected_proposal_id).toBeNull();
  await page.reload();
  await option(page, "Vueling").getByRole("button", { name: "Review decision →", exact: true }).click();
  await db`update public.trip_legs set selected_proposal_id = ${f.flights[1].id} where id = ${f.legId}`;
  await page.getByRole("button", { name: "Confirm selection", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("A flight has already been selected. Voting is closed.");
  expect((await db`select selected_proposal_id from public.trip_legs where id = ${f.legId}`)[0].selected_proposal_id).toBe(f.flights[1].id);
});

test("departures and removed proposals update totals; removed members cannot use a stale form", async ({ page }) => {
  const f = await fixture();
  await db`insert into public.flight_votes (trip_id, trip_leg_id, user_id, proposal_id)
    values (${f.tripId}, ${f.legId}, ${f.member.id}, ${f.flights[0].id}), (${f.tripId}, ${f.legId}, ${f.abstainer.id}, ${f.flights[1].id})`;
  await login(page, f.owner, f.path);
  await db`delete from public.trip_members where trip_id = ${f.tripId} and user_id = ${f.abstainer.id}`;
  await page.reload();
  await expect(page.getByText("1 of 2 votes cast · 1 undecided", { exact: true })).toBeVisible();
  await expect(option(page, "Vueling").getByText("50% support", { exact: true })).toBeVisible();
  await db`delete from public.flight_proposals where id = ${f.flights[0].id}`;
  await option(page, "Vueling").getByRole("button", { name: "Vote for this flight", exact: true }).click();
  await expect(page.getByRole("list", { name: "Voting results", exact: true }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("0 of 2 votes cast · 2 undecided", { exact: true })).toBeVisible();
  await login(page, f.member, f.path);
  await db`delete from public.trip_members where trip_id = ${f.tripId} and user_id = ${f.member.id}`;
  await option(page, "Ryanair").getByRole("button", { name: "Vote for this flight", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This travel leg is unavailable, or you are no longer a member.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Trip unavailable", exact: true })).toBeVisible();
});

test("failed writes report errors and can be retried; empty decisions and desktop layout work", async ({ page, browser }) => {
  const f = await fixture();
  await login(page, f.owner, f.path);
  await db`revoke insert on public.flight_votes from authenticated`;
  // INSERT is column-granted, so revoke those columns as well.
  await db`revoke insert (trip_id, trip_leg_id, proposal_id) on public.flight_votes from authenticated`;
  try {
    await option(page, "Vueling").getByRole("button", { name: "Vote for this flight", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("We couldn't save your vote. Refresh the results and try again.");
  } finally { await db`grant insert (trip_id, trip_leg_id, proposal_id) on public.flight_votes to authenticated`; }
  await option(page, "Vueling").getByRole("button", { name: "Vote for this flight", exact: true }).click();
  await expect(option(page, "Vueling").getByRole("button", { name: "Your vote", exact: true })).toBeDisabled();
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() });
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto(f.path);
    await expect(desktop.getByRole("heading", { name: "Group decision", exact: true })).toBeVisible();
    await desktop.screenshot({ path: "test-results/voting-desktop.png", fullPage: true });
    expect(await desktop.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  } finally { await desktopContext.close(); }
  await db`delete from public.flight_proposals where trip_leg_id = ${f.legId}`;
  await page.reload();
  await expect(page.getByRole("heading", { name: "No flights to vote on", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Propose option", exact: true })).toBeVisible();
});
