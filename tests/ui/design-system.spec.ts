import { expect, test } from "@playwright/test";

test("controls, keyboard dialog behavior, and responsive dock", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/design-system");
  await expect(page.getByRole("heading", { name: "Design system", exact: true })).toBeVisible();
  await page.getByLabel("Traveler name").fill("Alex Morgan");
  await page.getByLabel("Display preference").selectOption("comfortable");
  await expect(page.getByLabel("Display preference")).toHaveValue("comfortable");
  await expect(page.getByLabel("Field with an error")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Disabled field")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();

  const trigger = page.getByRole("button", { name: "Open dialog" });
  const dialog = page.getByRole("dialog", { name: "A little room to focus" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Save preview" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("Your name").fill("Sam");
  await dialog.getByRole("button", { name: "Save preview" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Dialog saved.", { exact: true })).toBeVisible();
  await trigger.click();
  await page.mouse.click(3, 3);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Components" })).toHaveAttribute("aria-current", "page");
  const navBox = await nav.boundingBox();
  expect(navBox!.x).toBeGreaterThan(0);
  expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/design-system-${testInfo.project.name}.png`, fullPage: true, caret: "initial" });
  expect(errors).toEqual([]);
});

test("auth screens use shared controls without mobile overflow", async ({ page }, testInfo) => {
  await page.goto("/signup?next=/invite/preview");
  await expect(page.getByRole("heading", { name: "Good trips start here." })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-describedby", "password-hint");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login?next=%2Finvite%2Fpreview");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/signup-system-${testInfo.project.name}.png`, fullPage: true, caret: "initial" });
  await page.goto("/login?error=invalid-link");
  await expect(page.locator("main").getByRole("alert")).toContainText("invalid or has expired");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
});
