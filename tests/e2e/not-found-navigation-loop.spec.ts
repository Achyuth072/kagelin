import { test, expect } from "@playwright/test";
import { seedGuestState } from "./support/guest-mode";

// Regression test: useBackAnchor bounces deep links through "/" so Back exits
// to home. On a 404 the return push() can't soft-navigate, so Next falls back
// to a full document load, remounting AppShell and resetting the hook's ref
// guard — which re-arms the bounce, forever. Any bad URL pinned the server at
// roughly two full page loads a second until the tab was closed.
const NOT_FOUND_PATH = "/no-such-page-xyz";

// The loop reloaded about every 2.5s, so the window has to span several periods
// to tell "settled" from "between reloads".
const SETTLE_MS = 5000;

test("a 404 route does not send the app into a navigation loop", async ({
  page,
  baseURL,
}) => {
  // Guest mode keeps this credential-free; the middleware lets guests through
  // to the 404 instead of redirecting to /login.
  await seedGuestState(page, baseURL!);

  let docLoads = 0;
  let total = 0;
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.origin === baseURL && u.pathname === NOT_FOUND_PATH) {
      total++;
      if (!u.searchParams.has("_rsc")) docLoads++;
    }
  });

  await page.goto(NOT_FOUND_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(SETTLE_MS);

  // One initial load plus at most one bounce-return. Looping produces dozens.
  expect(docLoads).toBeLessThanOrEqual(2);
  expect(total).toBeLessThanOrEqual(3);
});
