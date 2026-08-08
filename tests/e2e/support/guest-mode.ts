import type { Page } from "@playwright/test";

/**
 * Seeds guest mode (cookie + localStorage) and lands on `url`.
 * Lives here, not in a `*.spec.ts`, because Playwright forbids cross-spec imports.
 */
export async function seedGuestMode(
  page: Page,
  url = "http://localhost:3000/calendar",
) {
  await Promise.all([
    page.context().addCookies([
      {
        name: "kanso_guest_mode",
        value: "true",
        url: "http://localhost:3000/",
      },
    ]),
    page.addInitScript(() => {
      localStorage.setItem("kanso_guest_mode", "true");
    }),
  ]);
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
