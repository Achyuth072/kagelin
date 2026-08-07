import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// 3-Day and Week column fit parity at 600px viewport.
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
