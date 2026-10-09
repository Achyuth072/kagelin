import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const EMPTY_GUEST_DATA = {
  tasks: [],
  projects: [],
  habits: [],
  habit_entries: [],
  focus_logs: [],
  events: [],
  seed_ids: [],
};

function pageRootHeight(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-testid="scroll-container"]')!
        .firstElementChild!.getBoundingClientRect().height,
  );
}

async function expectPageToEndAtNav(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.querySelector(
          '[data-testid="scroll-container"]',
        )!.firstElementChild!;
        const nav = document.querySelector("nav.fixed.bottom-0")!;
        return Math.abs(
          nav.getBoundingClientRect().top - root.getBoundingClientRect().bottom,
        );
      }),
    )
    .toBeLessThanOrEqual(1);
}

for (const withDemoBar of [false, true]) {
  test.describe(withDemoBar ? "with Demo bar" : "without top banner", () => {
    test.beforeEach(async ({ page }) => {
      if (!withDemoBar) {
        await page.addInitScript((data) => {
          localStorage.setItem(
            "kanso_guest_data_v11",
            JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }),
          );
        }, EMPTY_GUEST_DATA);
      }
    });

    for (const path of ["/", "/habits"]) {
      test(`${path} ends at the nav`, async ({ page }) => {
        await seedGuestMode(page, `http://localhost:3000${path}`);
        await expectPageToEndAtNav(page);
      });
    }

    test("/calendar month view ends at the nav", async ({ page }) => {
      await seedGuestMode(page);
      await page.locator('[style*="grid-template-rows"]').waitFor();
      await expectPageToEndAtNav(page);
    });
  });
}

// overflow:hidden containers still scroll via keyboard focus or scrollIntoView.
test.describe("fixed-height routes have no hidden overflow", () => {
  for (const path of ["/", "/habits", "/calendar"]) {
    test(path, async ({ page }) => {
      await seedGuestMode(page, `http://localhost:3000${path}`);
      await expect.poll(() => pageRootHeight(page)).toBeGreaterThan(400);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const el = document.querySelector(
              '[data-testid="scroll-container"]',
            )!;
            return el.scrollHeight - el.clientHeight;
          }),
        )
        .toBeLessThanOrEqual(1);
    });
  }
});

test("a scrolling route's last content clears the nav", async ({ page }) => {
  await seedGuestMode(page, "http://localhost:3000/stats");
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="scroll-container"]')!;
    el.scrollTop = el.scrollHeight;
    const nav = document.querySelector("nav.fixed.bottom-0")!;
    return {
      scrolls: el.scrollHeight > el.clientHeight,
      contentBottom: el.firstElementChild!.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
    };
  });
  expect(m.scrolls).toBe(true);
  expect(m.contentBottom).toBeLessThanOrEqual(m.navTop);
});
