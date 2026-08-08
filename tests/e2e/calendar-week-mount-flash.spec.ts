import { test, expect, type Page, type Locator } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// Regression test: switching into week view flashed the 360px-guessed
// column width before snapping to the real measured one a frame later.
// See MobileWeekGrid.tsx's containerRef layout effect.
type SampleWindow = Window & {
  __colSamples: number[];
  __scrollSamples: number[];
  __done: boolean;
};

function maxJump(samples: number[]) {
  return Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
}

async function selectView(page: Page, name: string) {
  await page.locator('[role="combobox"]').first().click();
  await page.getByRole("option", { name, exact: true }).click();
}

function readIndicatorStyle(el: Element) {
  const s = getComputedStyle(el);
  return {
    fontSize: s.fontSize,
    marginLeft: s.marginLeft,
    paddingLeft: s.paddingLeft,
    textTransform: s.textTransform,
  };
}

async function captureIndicatorStyle(scope: Page | Locator) {
  const label = scope.locator('[data-testid="current-time-indicator"] span');
  await label.waitFor();
  // A class's first use on the page can read back blank a beat before CSS injects.
  await expect
    .poll(() => label.evaluate((el) => getComputedStyle(el).fontSize))
    .not.toBe("");
  return label.evaluate(readIndicatorStyle);
}

test.describe("mobile week view mount", () => {
  // 390px (iPhone 12/13/14) deliberately isn't the 360px the guess assumed.
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("day-column width and scrollLeft never jump across the switch into week view", async ({
    page,
  }) => {
    // Default view is "month" — start there so switching to week is a real
    // cross-view transition, not a fresh mount.
    await seedGuestMode(page);
    await page.locator('[role="combobox"]').first().waitFor();

    // Start sampling *before* triggering the switch so we catch frame 1.
    await page.evaluate(() => {
      const win = window as unknown as SampleWindow;
      win.__colSamples = [];
      win.__scrollSamples = [];
      win.__done = false;
      const t0 = performance.now();
      function tick() {
        const scroller = document.querySelector(
          '[data-testid="mobile-week-grid"]',
        );
        const col = document.querySelector('[data-testid="day-column"]');
        if (scroller && col) {
          win.__colSamples.push(Math.round(col.getBoundingClientRect().width));
          win.__scrollSamples.push((scroller as HTMLElement).scrollLeft);
        }
        if (performance.now() - t0 < 5000) {
          requestAnimationFrame(tick);
        } else {
          win.__done = true;
        }
      }
      requestAnimationFrame(tick);
    });

    await selectView(page, "Week");

    await page.waitForFunction(
      () => (window as unknown as SampleWindow).__done,
      { timeout: 10000 },
    );

    // tick() only pushes once both the scroller and a column exist, so
    // these arrays already start at mount — no pre-mount entries to trim.
    const { colSamples, scrollSamples } = await page.evaluate(() => {
      const win = window as unknown as SampleWindow;
      return {
        colSamples: win.__colSamples,
        scrollSamples: win.__scrollSamples,
      };
    });

    expect(colSamples.length).toBeGreaterThan(2);
    expect(maxJump(colSamples)).toBeLessThanOrEqual(1);
    expect(maxJump(scrollSamples)).toBeLessThanOrEqual(1);
  });

  // Regression test: the indicator used to render at two sizes (a `compact`
  // variant only MobileWeekGrid opted into), changing mid-transition.
  test("current-time indicator styles match switching between 3-Day and Week", async ({
    page,
  }) => {
    await seedGuestMode(page);
    await page.locator('[role="combobox"]').first().waitFor();

    await selectView(page, "3-Day");
    const threeDayStyle = await captureIndicatorStyle(page);

    await selectView(page, "Week");
    const weekGrid = page.locator('[data-testid="mobile-week-grid"]');
    await weekGrid.waitFor();
    const weekStyle = await captureIndicatorStyle(weekGrid);

    expect(weekStyle).toEqual(threeDayStyle);
  });
});
