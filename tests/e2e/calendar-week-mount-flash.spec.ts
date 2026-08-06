import { test, expect } from "@playwright/test";
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

    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: "Week", exact: true }).click();

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
});
