import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// Requires a production build (`npm run build && npm start`) — SW is disabled in dev.
test("app shell boots offline after the service worker has cached it", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await seedGuestMode(page, "http://localhost:3000/");

  const cached = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      const names = await caches.keys();
      for (const n of names) {
        const c = await caches.open(n);
        const hit = await c.match("/", { ignoreSearch: true });
        if (hit) return { found: true, cache: n, scope: reg.scope };
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return { found: false, caches: await caches.keys() };
  });

  console.log("SW_NAVIGATION_CACHE:", JSON.stringify(cached, null, 2));
  expect(cached.found).toBe(true);
  expect(cached.cache).toBe("pages");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("scroll-container")).toBeVisible();
  await expect(page.getByText("You're Offline")).toHaveCount(0);

  await context.setOffline(false);
});
