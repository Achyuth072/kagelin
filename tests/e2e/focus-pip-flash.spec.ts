import { test, expect } from "@playwright/test";

// Regression test: page-enter transform flashed the PiP button out of place (see app/template.tsx).
type PipWindow = Window & { __pipSamples: number[]; __pipDone: boolean };

test.describe("Focus page PiP button positioning", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test("PiP button never renders near the top of the screen during page-enter transition", async ({
    page,
  }) => {
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

    // So the /focus nav below is a client-side transition, not a reload.
    await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (page.url().includes("/login")) {
      throw new Error(
        `Guest-mode bypass failed: still on ${page.url()} after seeding cookie+localStorage`,
      );
    }
    // Ensures GlobalHotkeys has mounted before pressing "f" below.
    await expect(page.getByRole("link", { name: "Focus" }).first()).toBeVisible(
      { timeout: 15000 },
    );

    // Sample position every frame for 2s, well past the ~150ms transition.
    await page.evaluate(() => {
      const win = window as unknown as PipWindow;
      win.__pipSamples = [];
      win.__pipDone = false;
      const t0 = performance.now();
      function tick() {
        const el = document.querySelector('[title*="Picture-in-Picture"]');
        if (el) {
          win.__pipSamples.push(Math.round(el.getBoundingClientRect().y));
        }
        if (performance.now() - t0 < 2000) {
          requestAnimationFrame(tick);
        } else {
          win.__pipDone = true;
        }
      }
      requestAnimationFrame(tick);
    });

    // "f" hotkey navigates to /focus.
    await page.keyboard.press("f");
    await page.waitForFunction(
      () => (window as unknown as PipWindow).__pipDone,
      { timeout: 10000 },
    );

    const samples = await page.evaluate(
      () => (window as unknown as PipWindow).__pipSamples,
    );

    expect(samples.length).toBeGreaterThan(0);

    // Resting position is ~828px; far above that reproduces the flash.
    const badSamples = samples.filter((y) => y < 400);
    expect(badSamples).toEqual([]);
  });
});
