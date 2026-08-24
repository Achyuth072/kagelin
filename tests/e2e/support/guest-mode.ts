import type { Page } from "@playwright/test";

/**
 * Use directly when the spec must attach listeners before its own `goto`,
 * or lands somewhere the bounce never settles (an unanchored route, or a 404).
 */
export async function seedGuestState(page: Page, origin: string) {
  await Promise.all([
    page
      .context()
      .addCookies([
        { name: "kanso_guest_mode", value: "true", url: `${origin}/` },
      ]),
    page.addInitScript(() => {
      localStorage.setItem("kanso_guest_mode", "true");
    }),
  ]);
}

/**
 * Lives here, not in a `*.spec.ts`, because Playwright forbids cross-spec imports.
 */
export async function seedGuestMode(
  page: Page,
  url = "http://localhost:3000/calendar",
) {
  await seedGuestState(page, new URL(url).origin);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { pathname } = new URL(url);
  if (pathname !== "/") {
    await waitForBackAnchor(page, pathname);
  }
}

/**
 * Waits out the back anchor's bounce so locators don't race a subtree that's
 * about to be torn down. Also works after `page.reload()`.
 */
export async function waitForBackAnchor(page: Page, pathname: string) {
  await page.waitForFunction(
    (target) =>
      window.__backAnchorSettled === true &&
      window.location.pathname === target,
    pathname,
    // Dev-server hydration under parallel workers can exceed 15s.
    { timeout: 25000 },
  );
}
