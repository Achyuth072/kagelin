import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

function assertNotRedirectedToLogin(page: Page) {
  if (page.url().includes("/login")) {
    throw new Error(
      `Guest-mode bypass failed: still on ${page.url()} after seeding cookie+localStorage`,
    );
  }
}

async function clickBackButton(page: Page) {
  const backButton = page.getByRole("button").first();
  await expect(backButton).toBeVisible({ timeout: 10000 });
  await backButton.click();
}

// Mobile hides Focus in a sidebar sheet; on desktop the same trigger collapses it.
async function openFocusFromNav(page: Page) {
  const focusLink = page.getByRole("link", { name: "Focus" }).first();
  const sidebarTrigger = page
    .getByRole("button", { name: "Toggle Sidebar" })
    .first();
  await expect(focusLink.or(sidebarTrigger).first()).toBeVisible({
    timeout: 10000,
  });
  if (!(await focusLink.isVisible())) {
    await sidebarTrigger.click();
    await expect(focusLink).toBeVisible({ timeout: 10000 });
  }
  await focusLink.click();
  await page.waitForURL(/\/focus/);
}

// Regression: notificationclick's clients.openWindow (app/sw.ts) opens /focus
// with no prior history, so router.back() closed the PWA. Fixed by the back anchor.
test("focus page opened cold (as notification click would) falls back in-app instead of leaving the PWA", async ({
  page,
}) => {
  await seedGuestMode(page, "http://localhost:3000/focus");
  assertNotRedirectedToLogin(page);

  await clickBackButton(page);
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const urlAfterBack = page.url();
  expect(urlAfterBack).not.toBe("about:blank");
  expect(urlAfterBack.replace("http://localhost:3000", "")).toBe("/");
});

// Regression: page.goBack() drives the real history stack via popstate,
// bypassing useAnchoredBack's button gate — exercises OS/gesture back once the
// anchor has settled, which seedGuestMode already waits for.
test("focus page opened cold falls back on real browser back navigation once the back anchor settles", async ({
  page,
}) => {
  await seedGuestMode(page, "http://localhost:3000/focus");
  assertNotRedirectedToLogin(page);

  await page.goBack();
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const urlAfterBack = page.url();
  expect(urlAfterBack).not.toBe("about:blank");
  expect(urlAfterBack.replace("http://localhost:3000", "")).toBe("/");
});

// Regression: anchoring /login left the settle promise unresolved after sign-in,
// disabling back app-wide (see ADR-0011).
test("signing in from a cold-opened login page leaves back navigation working", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/focus", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(/\/login/, { timeout: 15000 });

  await page.getByRole("button", { name: "Guest" }).click();
  await page.waitForURL("http://localhost:3000/", { timeout: 15000 });

  await openFocusFromNav(page);
  await clickBackButton(page);
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  expect(page.url().replace("http://localhost:3000", "")).toBe("/");
});

test("focus page reached via in-app navigation still goes back to the previous page", async ({
  page,
}) => {
  await seedGuestMode(page, "http://localhost:3000/");
  assertNotRedirectedToLogin(page);

  await openFocusFromNav(page);
  await clickBackButton(page);
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  expect(page.url().replace("http://localhost:3000", "")).toBe("/");
});
