import { test, expect } from "@playwright/test";

async function seedGuestAndOpenWeek(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    {
      name: "kanso_guest_mode",
      value: "true",
      url: "http://localhost:3000/",
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("kanso_guest_mode", "true");
  });
  await page.goto("http://localhost:3000/calendar", {
    waitUntil: "domcontentloaded",
  });
  await page.locator('[role="combobox"]').first().click();
  await page.getByRole("option", { name: "Week", exact: true }).click();
  await page.locator('[data-testid="mobile-week-grid"]').waitFor();
}

function visibleColumnCount(
  columnBoxes: { x: number; width: number }[],
  scrollerBox: { x: number; width: number },
  tolerance = 2,
) {
  return columnBoxes.filter(
    (box) =>
      box.x >= scrollerBox.x - tolerance &&
      box.x + box.width <= scrollerBox.x + scrollerBox.width + tolerance,
  ).length;
}

test.describe("mobile week view", () => {
  test.use({ hasTouch: true });

  test("opens with today's column landed inside the visible window", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedGuestAndOpenWeek(page);

    const scrollerBox = await page
      .locator('[data-testid="mobile-week-grid"]')
      .boundingBox();
    const todayBox = await page
      .locator('[data-testid="day-column"][data-today="true"]')
      .boundingBox();

    expect(scrollerBox).toBeTruthy();
    expect(todayBox).toBeTruthy();
    if (!scrollerBox || !todayBox) return;

    expect(todayBox.x).toBeGreaterThanOrEqual(scrollerBox.x - 2);
    expect(todayBox.x + todayBox.width).toBeLessThanOrEqual(
      scrollerBox.x + scrollerBox.width + 2,
    );
  });

  test("shows 3 columns at 360px and 6 at 767px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedGuestAndOpenWeek(page);

    const scroller = page.locator('[data-testid="mobile-week-grid"]');
    const columns = page.locator('[data-testid="day-column"]');

    const scrollerBox360 = await scroller.boundingBox();
    const columnBoxes360 = await columns.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      }),
    );
    expect(scrollerBox360).toBeTruthy();
    if (scrollerBox360) {
      expect(visibleColumnCount(columnBoxes360, scrollerBox360)).toBe(3);
    }

    await page.setViewportSize({ width: 767, height: 780 });
    await page.waitForTimeout(200); // let the ResizeObserver settle

    const scrollerBox767 = await scroller.boundingBox();
    const columnBoxes767 = await columns.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      }),
    );
    expect(scrollerBox767).toBeTruthy();
    if (scrollerBox767) {
      expect(visibleColumnCount(columnBoxes767, scrollerBox767)).toBe(6);
    }
  });

  test("a swipe from the end edge pages to next week, landing at the start", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedGuestAndOpenWeek(page);

    const scroller = page.locator('[data-testid="mobile-week-grid"]');
    const datesBefore = await page
      .locator('[data-testid="day-column"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-date")));

    // Synthetic swipe: Playwright's touch API has no drag.
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });
    await scroller.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const y = rect.y + 100;
      const touchInit = (x: number) => ({
        touches: [
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y }),
        ],
        changedTouches: [
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y }),
        ],
        bubbles: true,
      });
      el.dispatchEvent(
        new TouchEvent("touchstart", touchInit(rect.x + rect.width - 10)),
      );
      el.dispatchEvent(new TouchEvent("touchend", touchInit(rect.x + 10)));
    });

    // Paging lands after a debounced scroll-settle, not instantly — poll for it.
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollLeft), { timeout: 2000 })
      .toBeLessThanOrEqual(2);

    const columnsAfter = page.locator('[data-testid="day-column"]');
    const datesAfter = await columnsAfter.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-date")),
    );

    expect(datesAfter[0]).not.toBe(datesBefore[0]);
    // The bridge's 14-day strip must collapse back to a normal 7-day week.
    await expect(columnsAfter).toHaveCount(7);
  });

  test("a swipe from the start edge pages to prev week, landing at the end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedGuestAndOpenWeek(page);

    const scroller = page.locator('[data-testid="mobile-week-grid"]');
    const datesBefore = await page
      .locator('[data-testid="day-column"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-date")));

    // Already parked at the start edge (scrollLeft: 0) by default.
    await scroller.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const y = rect.y + 100;
      const touchInit = (x: number) => ({
        touches: [
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y }),
        ],
        changedTouches: [
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y }),
        ],
        bubbles: true,
      });
      el.dispatchEvent(new TouchEvent("touchstart", touchInit(rect.x + 10)));
      el.dispatchEvent(
        new TouchEvent("touchend", touchInit(rect.x + rect.width - 10)),
      );
    });

    // Paging backward lands at the end edge, not scrollLeft 0 — poll for the
    // scroller's max, which exercises the prepend-jump path that the
    // forward-paging test above never touches.
    await expect
      .poll(
        () =>
          scroller.evaluate(
            (el) => el.scrollWidth - el.clientWidth - el.scrollLeft,
          ),
        { timeout: 2000 },
      )
      .toBeLessThanOrEqual(2);

    const columnsAfter = page.locator('[data-testid="day-column"]');
    const datesAfter = await columnsAfter.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-date")),
    );

    expect(datesAfter[0]).not.toBe(datesBefore[0]);
    await expect(columnsAfter).toHaveCount(7);
  });
});
