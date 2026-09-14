import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// Regression: the auth proxy's static-asset exemption excluded sw.js by exact
// name but not Serwist's swe-worker-<hash>.js push-event chunk, so an
// unauthenticated visitor's browser fetched a 307-to-/login redirect for it.
// Firefox refuses to run a Worker whose resolved URL is text/html (Chromium
// tolerates it silently) — hence Firefox-only symptom. See proxy.ts's
// extension exclusion list.
// Requires a production build (`npm run build && npm start`) — the SW is
// disabled in dev — with CSP_MODE unset (enforcing), matching the deploy
// this regression shipped under.
test("service worker registers with no worker or CSP console errors", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await seedGuestMode(page, "http://localhost:3000/");

  const registration = await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      if (reg.active?.state === "activated") return reg.active.state;
      await new Promise((r) => setTimeout(r, 200));
    }
    return reg.active?.state ?? null;
  });

  expect(registration).toBe("activated");

  const workerOrCspErrors = consoleErrors.filter((e) =>
    /disallowed MIME type|NS_ERROR_CORRUPTED_CONTENT|Content Security Policy|worker-src/i.test(
      e,
    ),
  );
  expect(workerOrCspErrors).toEqual([]);
});
