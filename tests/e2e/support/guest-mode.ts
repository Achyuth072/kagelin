import type { Page } from "@playwright/test";

type TrapWindow = Window & { __historyLengthAtLoad: number };

/**
 * Seeds guest mode (cookie + localStorage) and lands on `url`.
 * Shared across e2e specs — Playwright forbids importing one spec file from
 * another, so this can't live inside a `*.spec.ts`.
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
      (window as unknown as TrapWindow).__historyLengthAtLoad =
        window.history.length;
    }),
  ]);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { pathname } = new URL(url);
  if (pathname !== "/") {
    await waitForColdOpenSettle(page, pathname);
  }
}

/**
 * Waits out the cold-open back-nav trap (useColdOpenBackTrap) so locators
 * don't race a subtree that's about to be torn down. Also works after a
 * `page.reload()`, which re-triggers the trap.
 */
export async function waitForColdOpenSettle(page: Page, pathname: string) {
  await page.waitForFunction(
    (target) => {
      const win = window as unknown as TrapWindow;
      return (
        window.location.pathname === target &&
        window.history.length > win.__historyLengthAtLoad
      );
    },
    pathname,
    { timeout: 15000 },
  );
}
