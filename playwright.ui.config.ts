import { defineConfig } from "@playwright/test";

// UI checks use no database, signup, email, or Docker services.
export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", browserName: "chromium", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "yarn dev --hostname localhost --port 3000",
    url: "http://localhost:3000/design-system",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
