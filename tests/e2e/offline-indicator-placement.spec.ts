import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

/**
 * The offline indicator must never cover content on mobile and must stay
 * centred in the content column on desktop — including with the sidebar
 * collapsed, which the old `--sidebar-width` maths got wrong.
 */

const BANNER = '[data-testid="offline-indicator"]';

/**
 * OfflineIndicator is a `ssr: false` dynamic import, so its chunk is only
 * fetched the first time it renders — which never succeeds if the network is
 * already down. Fake an offline event to pull the chunk in, then restore the
 * native `navigator.onLine` getter so the real `setOffline` still registers.
 */
async function warmIndicatorChunk(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.locator(BANNER)).toBeVisible();
  await page.evaluate(() => {
    delete (navigator as unknown as Record<string, unknown>).onLine;
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.locator(BANNER)).toBeHidden();
}

async function goOffline(page: Page) {
  await warmIndicatorChunk(page);
  await page.context().setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await expect(page.locator(BANNER)).toBeVisible();
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`no bounding box for ${selector}`);
  return rect;
}

test.describe("offline indicator placement", () => {
  test("mobile: strip sits under the header and covers no content", async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "mobile viewports only",
    );

    await seedGuestMode(page, "http://localhost:3000/");
    await goOffline(page);

    // Top edge of the strip meets the bottom edge of the fixed header.
    // Polled: the entry spring has to settle before the offset is meaningful.
    await expect
      .poll(async () => {
        const header = await box(page, "header");
        const banner = await box(page, BANNER);
        return Math.abs(banner.y - (header.y + header.height));
      })
      .toBeLessThan(2);

    const banner = await box(page, BANNER);
    expect(banner.width).toBeGreaterThanOrEqual(
      (page.viewportSize()?.width ?? 0) - 1,
    );

    // Content starts below the strip — the scroll container was pushed down.
    const contentTop = await page
      .getByTestId("scroll-container")
      .evaluate((el) => {
        const child = el.firstElementChild as HTMLElement | null;
        return (child ?? el).getBoundingClientRect().top;
      });
    expect(contentTop).toBeGreaterThanOrEqual(banner.y + banner.height - 1);
  });

  test("desktop: pill stays centred in the content column when the sidebar collapses", async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 768,
      "desktop viewports only",
    );

    await seedGuestMode(page, "http://localhost:3000/");
    await goOffline(page);

    const centreOffset = async () => {
      const inset = await box(page, "main");
      const pill = await box(page, `${BANNER} > div`);
      return Math.abs(pill.x + pill.width / 2 - (inset.x + inset.width / 2));
    };

    await expect.poll(centreOffset).toBeLessThan(4);

    await page.keyboard.press("ControlOrMeta+b");
    await expect(
      page.locator('[data-state="collapsed"]').first(),
    ).toBeAttached();
    // Sidebar width transition is 200ms.
    await page.waitForTimeout(400);

    await expect.poll(centreOffset).toBeLessThan(4);
  });
});
