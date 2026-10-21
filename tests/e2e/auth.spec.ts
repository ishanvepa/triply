import { test, expect, type BrowserContext } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";

const db = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => {} });
const createdEmails: string[] = [];
test.afterAll(async () => {
  for (const email of createdEmails) await db`delete from auth.users where email = ${email}`;
  await db.end();
});

async function confirmationLink(email: string) {
  let link = "";
  await expect.poll(async () => {
    const list = await (await fetch("http://127.0.0.1:54324/api/v1/messages")).json();
    const message = list.messages?.find((item: { To: { Address: string }[] }) => item.To.some((to) => to.Address === email));
    if (!message) return false;
    const body = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
    const links = [...String(body.HTML).matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
    link = links.find((value) => new URL(value).pathname === "/auth/confirm") ?? "";
    return !!link;
  }, { timeout: 30000, message: "Local confirmation email arrives" }).toBe(true);
  expect(new URL(link).origin).toBe("http://127.0.0.1:3100");
  return link;
}

async function authCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

test("protected paths preserve their destination and auth callbacks reject open redirects", async ({ page, request, context }) => {
  for (const path of ["/settings?from=trip", "/trips/example?tab=flights", "/invite/example-token?source=friend"]) {
    await page.goto(path);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
    await page.getByRole("link", { name: "Create an account" }).click();
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  }
  await page.goto("/login?next=https://evil.test");
  await expect(page.locator('input[name="next"]')).toHaveValue("/settings");
  for (const path of ["/auth/callback?next=//evil.test", "/auth/callback?code=invalid&next=/trips", "/auth/confirm?token_hash=invalid&type=email&next=/settings"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const destination = new URL(response.headers().location);
    expect(destination.origin).toBe("http://127.0.0.1:3100");
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("error")).toBe("invalid-link");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  const id = randomUUID();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const signature = createHmac("sha256", "deliberately-invalid-test-key").update(`${header}.${payload}`).digest("base64url");
  const forged = { access_token: `${header}.${payload}.${signature}`, refresh_token: "invalid", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(forged)).toString("base64url")}`, domain: "127.0.0.1", path: "/" }]);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("signup confirmation, profile ownership, persistent and refreshed sessions, login and logout", async ({ page, browser }) => {
  const email = `triply-auth-e2e-${randomUUID()}@example.test`;
  const otherEmail = `triply-auth-e2e-${randomUUID()}@example.test`;
  createdEmails.push(email, otherEmail);
  const otherId = randomUUID();
  await db`insert into auth.users (id, email) values (${otherId}, ${otherEmail})`;
  await db`update public.profiles set display_name = 'Other traveler' where id = ${otherId}`;
  const password = `Long password ${randomUUID()} `;
  const destination = "/settings?from=invitation";
  await page.goto(`/signup?${new URLSearchParams({ next: destination })}`);
  await page.screenshot({ path: "test-results/signup-mobile.png", fullPage: true, caret: "initial" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Your name").fill("Alex Traveler");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = await confirmationLink(email);

  // Confirmation works without the original browser's PKCE cookie when the
  // recommended token-hash email template is used.
  const confirmationContext = await browser.newContext();
  const confirmed = await confirmationContext.newPage();
  await confirmed.goto(link);
  await expect(confirmed).toHaveURL(`http://127.0.0.1:3100${destination}`);
  await expect(confirmed.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(confirmed.getByLabel("Your name")).toHaveValue("Alex Traveler");
  const reused = await page.request.get(link, { maxRedirects: 0 });
  expect(new URL(reused.headers().location).searchParams.get("error")).toBe("invalid-link");
  const persisted = await confirmationContext.storageState();
  await confirmationContext.close();

  const context = await browser.newContext({ storageState: persisted, viewport: { width: 390, height: 844 } });
  const account = await context.newPage();
  await account.goto(destination);
  await expect(account.getByLabel("Your name")).toHaveValue("Alex Traveler");
  await account.getByLabel("Your name").fill("Alex Updated");
  await account.locator('form:has(input[name="fullName"])').evaluate((form, id) => {
    const input = document.createElement("input"); input.name = "user_id"; input.value = id; form.append(input);
  }, otherId);
  await account.getByRole("button", { name: "Save changes" }).click();
  await expect(account.getByRole("status")).toHaveText("Your name has been saved.");
  const [other] = await db`select display_name from public.profiles where id = ${otherId}`;
  expect(other.display_name).toBe("Other traveler");
  await account.reload();
  await expect(account.getByLabel("Your name")).toHaveValue("Alex Updated");

  const cookies = await authCookies(context);
  expect(cookies.length).toBeGreaterThan(0);
  const encoded = cookies.map((cookie) => cookie.value).join("");
  expect(encoded.startsWith("base64-")).toBe(true);
  const session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString());
  const previousRefreshToken = session.refresh_token;
  session.expires_at = 1;
  const expired = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const baseName = cookies[0].name.replace(/\.\d+$/, "");
  await context.clearCookies({ name: /-auth-token(?:\.\d+)?$/ });
  const chunks = expired.match(/.{1,3180}/g)!;
  await context.addCookies(chunks.map((value, index) => ({ ...cookies[0], name: chunks.length === 1 ? baseName : `${baseName}.${index}`, value })));
  const refreshed = await account.reload();
  await expect(account.getByRole("heading", { name: "Your account" })).toBeVisible();
  expect(refreshed?.headers()["cache-control"]).toContain("no-store");
  const renewed = (await authCookies(context)).map((cookie) => cookie.value).join("");
  expect(JSON.parse(Buffer.from(renewed.slice(7), "base64url").toString()).refresh_token).not.toBe(previousRefreshToken);
  expect(await account.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await account.screenshot({ path: "test-results/account-mobile.png", fullPage: true });
  await account.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(account).toHaveURL(/\/login\?message=signed-out$/);
  expect((await authCookies(context)).length).toBe(0);
  await account.goto(destination);
  await expect(account.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  const invitationDestination = "/invite/example-token?source=friend";
  await account.goto(`/login?${new URLSearchParams({ next: invitationDestination })}`);
  await account.getByLabel("Email address").fill(email);
  await account.getByLabel("Password", { exact: true }).fill("Wrong password");
  await account.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(account.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect.");
  await account.getByLabel("Password", { exact: true }).fill(password);
  await account.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(account).toHaveURL(`http://127.0.0.1:3100${invitationDestination}`);
  await expect(account.getByRole("heading", { name: "Group invitations" })).toBeVisible();
  await account.goto(destination);
  await expect(account.getByLabel("Your name")).toHaveValue("Alex Updated");
  await context.close();
});

test("default email PKCE confirmation completes in the original browser", async ({ page }) => {
  const email = `triply-auth-e2e-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const password = `Long password ${randomUUID()}`;
  await page.goto("/signup?next=/trips");
  await page.getByLabel("Your name").fill("Sam Traveler");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const tokenLink = new URL(await confirmationLink(email));
  await page.goto("/login?next=/trips");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Confirm your email before signing in.");
  // Supabase's default {{ .ConfirmationURL }} verifies at Auth first, then
  // returns a PKCE code to the app. Exercise that real provider path as well
  // as the direct token-hash template tested above.
  const providerLink = new URL("http://127.0.0.1:54321/auth/v1/verify");
  providerLink.searchParams.set("token", tokenLink.searchParams.get("token_hash")!);
  providerLink.searchParams.set("type", "signup");
  providerLink.searchParams.set("redirect_to", "http://127.0.0.1:3100/auth/callback?next=/trips");
  let sawCode = false;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/auth/callback" && url.searchParams.has("code")) sawCode = true;
  });
  await page.goto(providerLink.toString());
  await expect(page).toHaveURL("http://127.0.0.1:3100/trips");
  await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
  expect(sawCode).toBe(true);
});
