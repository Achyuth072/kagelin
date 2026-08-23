import { test, expect } from "@playwright/test";
import { seedGuestState } from "./support/guest-mode";

// Regression test: useBackAnchor bounces deep links through "/" so Back exits
// to home, which made opening an admin route render the tasks page for a beat
// before landing. Admin routes opt out of the bounce — see useBackAnchor.ts.
//
// The bounce fires from the mount effect, within ~2s of hydration, so the wait
// has to outlast that rather than just reaching a quiet network.
const SETTLE_MS = 4000;

test("opening an admin route never renders / on the way", async ({
  page,
  baseURL,
}) => {
  await seedGuestState(page, baseURL!);

  const homeHits: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.origin === baseURL && u.pathname === "/") homeHits.push(u.href);
  });

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(SETTLE_MS);

  // The bounce is the only thing that would fetch "/" here. Kept as URLs so a
  // failure names the offending request.
  expect(homeHits).toEqual([]);
  expect(new URL(page.url()).pathname).toBe("/admin");
});
