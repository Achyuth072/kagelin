import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// Faithful repro: never registers the SW by hand — relies solely on the
// registration @serwist/next injects, exactly as a real visitor would.
test("uncached navigation offline renders the offline shell", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await seedGuestMode(page, "http://localhost:3000/");

  const state = await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) {
        for (const n of await caches.keys()) {
          const c = await caches.open(n);
          if (await c.match("/offline.html", { ignoreSearch: true })) {
            return { autoRegistered: true, precached: true, cache: n };
          }
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      autoRegistered: !!reg?.active,
      precached: false,
      caches: await caches.keys(),
    };
  });
  console.log("SW_STATE:", JSON.stringify(state, null, 2));
  expect(state.autoRegistered).toBe(true);
  expect(state.precached).toBe(true);

  await context.setOffline(true);
  await page.goto("http://localhost:3000/never-visited-route-xyz", {
    waitUntil: "domcontentloaded",
  });
  console.log("TITLE:", await page.title());

  await expect(
    page.getByRole("heading", { name: "You're Offline" }),
  ).toBeVisible();

  await context.setOffline(false);
});
