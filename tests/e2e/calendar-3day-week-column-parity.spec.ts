import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// Regression test: below 768px, 3-Day derives its day count from measured
// width the same way Week's Day window does. At 600px (inside the
// 464-767px band) they must agree — see CONTEXT.md "Rolling view".
//
// Week always renders all 7 days in the DOM (it's a scroller, not a
// fixed-count grid), so column count alone can't be compared directly.
// Instead this derives how many columns actually fit Week's visible width
// from rendered pixels, the same way computeWindowGeometry does.
async function selectView(page: Page, name: string) {
  await page.locator('[role="combobox"]').first().click();
  await page.getByRole("option", { name, exact: true }).click();
}

test.describe("3-Day/Week column parity", () => {
  test.use({ hasTouch: true, viewport: { width: 600, height: 800 } });

  test("3-Day and Week fit the same number of day columns at 600px", async ({
    page,
  }) => {
    await seedGuestMode(page);
    await page.locator('[role="combobox"]').first().waitFor();

    await selectView(page, "3-Day");
    const threeDayColumns = page.locator('[data-testid="day-column"]');
    await threeDayColumns.first().waitFor();
    const threeDayCount = await threeDayColumns.count();

    await selectView(page, "Week");
    const weekGrid = page.locator('[data-testid="mobile-week-grid"]');
    await weekGrid.waitFor();
    const gutter = weekGrid.locator('[data-testid="time-gutter"]');
    const firstWeekColumn = weekGrid
      .locator('[data-testid="day-column"]')
      .first();
    await firstWeekColumn.waitFor();

    const [scrollerWidth, gutterWidth, colWidth] = await Promise.all([
      weekGrid.evaluate((el) => el.clientWidth),
      gutter.evaluate((el) => el.getBoundingClientRect().width),
      firstWeekColumn.evaluate((el) => el.getBoundingClientRect().width),
    ]);
    const weekFitCount = Math.round((scrollerWidth - gutterWidth) / colWidth);

    expect(threeDayCount).toBe(weekFitCount);
    expect(threeDayCount).toBeGreaterThan(3);
  });
});
