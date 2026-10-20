import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

// Load only local status into memory. Never use .env.local's hosted credentials
// for automated signup or browser tests, and never print the CLI's admin keys.
const require = createRequire(`${process.cwd()}/package.json`);
const status = JSON.parse(execFileSync(process.execPath, [
  require.resolve("supabase/dist/supabase.js"), "status", "-o", "json",
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const settings = status.data ?? status;
const apiUrl = settings.API_URL ?? settings.api_url;
const anonKey = settings.ANON_KEY ?? settings.anon_key;
if (!apiUrl || !anonKey || new URL(apiUrl).hostname !== "127.0.0.1") {
  throw new Error("Start local Supabase Auth with yarn auth:start before running the browser tests.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: {
    command: "yarn dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    },
  },
});
