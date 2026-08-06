import type { Page } from "@playwright/test";

/**
 * Seeds guest mode (cookie + localStorage) and lands on `url`.
 * Shared across e2e specs — Playwright forbids importing one spec file from
 * another, so this can't live inside a `*.spec.ts`.
 */
export async function seedGuestMode(
  page: Page,
  url = "http://localhost:3000/calendar",
) {
  await page.context().addCookies([
    {
      name: "kanso_guest_mode",
      value: "true",
      url: "http://localhost:3000/",
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("kanso_guest_mode", "true");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
