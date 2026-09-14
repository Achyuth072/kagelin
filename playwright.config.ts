import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";

// Next.js loads .env.local only in its child process; load here for specs needing SUPABASE_SECRET_KEY.
try {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // .env.local is optional.
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Real WebKit engine — catches scroll/snap bugs Chromium won't reproduce.
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 360, height: 780 },
      },
    },
    {
      // Real Firefox engine — catches worker-MIME-type bugs Chromium tolerates silently.
      // Scoped to the SW regression spec only: the rest of the suite isn't
      // written against Firefox's offline/navigation quirks (e.g.
      // offline-fallback.spec.ts) and isn't in scope here.
      name: "firefox",
      testMatch: "sw-registers-firefox.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
