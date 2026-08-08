import { test, expect, chromium } from "@playwright/test";

/**
 * Toast width should hug its content, not Sonner's default 356px.
 * Connects to CDP at localhost:9222 (system Chrome) — Playwright's bundled
 * chromium is missing system libs in this WSL env.
 */
const CDP_ENDPOINT = "http://localhost:9222";

// No CI or teammate machine launches Chrome with --remote-debugging-port=9222;
// probe first so those runs skip instead of failing on a connection error.
async function cdpReachable() {
  try {
    const res = await fetch(`${CDP_ENDPOINT}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe("Sonner toast width", () => {
  test.setTimeout(90_000);
  test("toast width hugs content (no excess empty space)", async () => {
    test.skip(!(await cdpReachable()), `no CDP endpoint at ${CDP_ENDPOINT}`);
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    // Pre-seed guest mode — the Guest button's signInAsGuest()+push races the
    // auth guard under CDP, redirect-looping back to /login.
    await context.addCookies([
      {
        name: "kanso_guest_mode",
        value: "true",
        url: "http://localhost:3000/",
      },
    ]);
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        localStorage.setItem("kanso_guest_mode", "true");
      });

      // Skips the home page and the Settings nav click.
      await page.goto("http://localhost:3000/settings", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log("[debug] after goto /settings, url=", page.url());

      if (page.url().includes("/login")) {
        throw new Error(
          `Guest-mode bypass failed: still on ${page.url()} after seeding cookie+localStorage`,
        );
      }

      await expect(
        page.getByRole("heading", { name: /settings/i }).first(),
      ).toBeVisible({ timeout: 15000 });
      console.log("[debug] settings heading visible");

      const accountTab = page
        .getByRole("button", { name: /^account$/i })
        .or(page.getByRole("tab", { name: /^account$/i }))
        .first();
      if (await accountTab.isVisible().catch(() => false)) {
        await accountTab.click();
        console.log("[debug] clicked account tab");
      } else {
        console.log("[debug] account tab not present, continuing");
      }

      const resetBtn = page.getByRole("button", { name: /reset demo/i });
      await expect(resetBtn).toBeVisible({ timeout: 10000 });
      console.log("[debug] reset btn visible, clicking");
      await resetBtn.click();

      const toastLi = page.locator("[data-sonner-toast]").first();
      await expect(toastLi).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);

      const measurement = await toastLi.evaluate((el) => {
        const li = el as HTMLElement;
        const rect = li.getBoundingClientRect();
        const cs = getComputedStyle(li);
        const ol = li.closest("[data-sonner-toaster]") as HTMLElement | null;
        const olRect = ol?.getBoundingClientRect();
        const olCs = ol ? getComputedStyle(ol) : null;

        const childrenWidth = Array.from(li.children).reduce((sum, child) => {
          return sum + (child as HTMLElement).getBoundingClientRect().width;
        }, 0);

        const contentEl = li.querySelector(
          "[data-content]",
        ) as HTMLElement | null;
        const contentRect = contentEl
          ? contentEl.getBoundingClientRect()
          : null;

        return {
          // <li data-sonner-toast>
          liWidth: rect.width,
          liHeight: rect.height,
          liComputedWidth: cs.width,
          liComputedMaxWidth: cs.maxWidth,
          liComputedDisplay: cs.display,
          liInlineStyleWidth: li.style.width,
          liInlineStyleMaxWidth: li.style.maxWidth,
          liPaddingLeft: parseFloat(cs.paddingLeft),
          liPaddingRight: parseFloat(cs.paddingRight),
          liClassName: li.className,
          // <ol data-sonner-toaster>
          olWidth: olRect?.width ?? -1,
          olComputedWidth: olCs?.width ?? "n/a",
          olInlineWidth: ol?.style.width ?? "n/a",
          olInlineCustomWidth: ol?.style.getPropertyValue("--width") ?? "n/a",
          // content
          contentWidth: contentRect?.width ?? 0,
          contentRight: contentRect?.right ?? 0,
          liRight: rect.right,
          gapRightInside: contentRect
            ? rect.right - parseFloat(cs.paddingRight) - contentRect.right
            : -1,
          childrenWidth,
          viewport: {
            w: window.innerWidth,
            h: window.innerHeight,
          },
        };
      });

      console.log(
        "[toast-width measurement]\n" + JSON.stringify(measurement, null, 2),
      );

      // Well under Sonner's ~356px default.
      expect(measurement.liWidth).toBeLessThan(280);

      // Flush, with tolerance for the flex gap.
      expect(measurement.gapRightInside).toBeLessThan(12);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test("short toast renders on a single line on desktop", async () => {
    test.skip(!(await cdpReachable()), `no CDP endpoint at ${CDP_ENDPOINT}`);
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await context.addCookies([
      {
        name: "kanso_guest_mode",
        value: "true",
        url: "http://localhost:3000/",
      },
    ]);
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        localStorage.setItem("kanso_guest_mode", "true");
      });

      await page.goto("http://localhost:3000/settings", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log("[debug-singleline] after goto /settings, url=", page.url());

      if (page.url().includes("/login")) {
        throw new Error(
          `Guest-mode bypass failed: still on ${page.url()} after seeding cookie+localStorage`,
        );
      }

      await expect(
        page.getByRole("heading", { name: /settings/i }).first(),
      ).toBeVisible({ timeout: 15000 });

      const accountTab = page
        .getByRole("button", { name: /^account$/i })
        .or(page.getByRole("tab", { name: /^account$/i }))
        .first();
      if (await accountTab.isVisible().catch(() => false)) {
        await accountTab.click();
      }

      const resetBtn = page.getByRole("button", { name: /reset demo/i });
      await expect(resetBtn).toBeVisible({ timeout: 10000 });
      await resetBtn.click();

      const toastLi = page.locator("[data-sonner-toast]").first();
      await expect(toastLi).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);

      const measurement = await toastLi.evaluate((el) => {
        const li = el as HTMLElement;
        const liRect = li.getBoundingClientRect();
        const titleEl = li.querySelector("[data-title]") as HTMLElement | null;
        if (!titleEl) {
          return {
            ok: false as const,
            reason: "no [data-title] inside toast li",
            liWidth: liRect.width,
            liHeight: liRect.height,
          };
        }
        const titleRect = titleEl.getBoundingClientRect();
        const titleCs = getComputedStyle(titleEl);
        const titleLineHeightRaw = titleCs.lineHeight;
        // line-height: "normal" → fall back to ~1.2 * font-size
        let titleLineHeight = parseFloat(titleLineHeightRaw);
        if (Number.isNaN(titleLineHeight)) {
          const fontSize = parseFloat(titleCs.fontSize);
          titleLineHeight = fontSize * 1.2;
        }
        return {
          ok: true as const,
          liWidth: liRect.width,
          liHeight: liRect.height,
          titleHeight: titleRect.height,
          titleLineHeight,
          titleLineHeightRaw,
          titleFontSize: titleCs.fontSize,
          titleText: titleEl.textContent ?? "",
          ratio: titleRect.height / titleLineHeight,
          viewport: {
            w: window.innerWidth,
            h: window.innerHeight,
          },
        };
      });

      console.log(
        "[toast-singleline measurement]\n" +
          JSON.stringify(measurement, null, 2),
      );

      if (!measurement.ok) {
        throw new Error(`Measurement failed: ${measurement.reason}`);
      }

      // 30% tolerance for rounding; a 2-line wrap would be ~2x lineHeight.
      expect(measurement.titleHeight).toBeLessThanOrEqual(
        measurement.titleLineHeight * 1.3,
      );
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test("toast is horizontally centered on mobile viewport (360px)", async () => {
    // Bundled Chromium, no CDP. Fixed viewport so Sonner's mobile rules fire.
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
    });
    await context.addCookies([
      {
        name: "kanso_guest_mode",
        value: "true",
        url: "http://localhost:3000/",
      },
    ]);
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        localStorage.setItem("kanso_guest_mode", "true");
      });

      await page.goto("http://localhost:3000/settings", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log("[debug-mobile] after goto /settings, url=", page.url());

      if (page.url().includes("/login")) {
        throw new Error(
          `Guest-mode bypass failed: still on ${page.url()} after seeding cookie+localStorage`,
        );
      }

      await expect(
        page.getByRole("heading", { name: /settings/i }).first(),
      ).toBeVisible({ timeout: 15000 });

      const accountTab = page
        .getByRole("button", { name: /^account$/i })
        .or(page.getByRole("tab", { name: /^account$/i }))
        .first();
      if (await accountTab.isVisible().catch(() => false)) {
        await accountTab.click();
      }

      const resetBtn = page.getByRole("button", { name: /reset demo/i });
      await expect(resetBtn).toBeVisible({ timeout: 10000 });
      await resetBtn.click();

      const toastLi = page.locator("[data-sonner-toast]").first();
      await expect(toastLi).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);

      const measurement = await toastLi.evaluate((el) => {
        const li = el as HTMLElement;
        const rect = li.getBoundingClientRect();
        const ol = li.closest("[data-sonner-toaster]") as HTMLElement | null;
        const olRect = ol?.getBoundingClientRect();
        const liCenter = (rect.left + rect.right) / 2;
        const viewportCenter = window.innerWidth / 2;
        return {
          liRect: {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            top: rect.top,
            bottom: rect.bottom,
          },
          olRect: olRect
            ? {
                left: olRect.left,
                right: olRect.right,
                width: olRect.width,
              }
            : null,
          liCenter,
          viewportCenter,
          delta: Math.abs(liCenter - viewportCenter),
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        };
      });

      console.log(
        "[toast-mobile-center measurement]\n" +
          JSON.stringify(measurement, null, 2),
      );

      // 8px tolerance covers fractional pixels and any rounding.
      expect(measurement.delta).toBeLessThan(8);
    } finally {
      await page.close();
      await browser.close();
    }
  });
});
