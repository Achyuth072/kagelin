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

async function pageBottomVsNavTop(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector(
      '[data-testid="scroll-container"]',
    )!.firstElementChild!;
    const nav = document.querySelector("nav.fixed.bottom-0")!;
    return {
      pageBottom: root.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
    };
  });
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
        const m = await pageBottomVsNavTop(page);
        expect(Math.abs(m.navTop - m.pageBottom)).toBeLessThanOrEqual(1);
      });
    }

    test("/calendar month view ends at the nav", async ({ page }) => {
      await seedGuestMode(page);
      await page.locator('[style*="grid-template-rows"]').waitFor();
      const m = await pageBottomVsNavTop(page);
      expect(Math.abs(m.navTop - m.pageBottom)).toBeLessThanOrEqual(1);
    });
  });
}
