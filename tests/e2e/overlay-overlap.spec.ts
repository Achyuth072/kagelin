import { test, expect, type Page, type Locator } from "@playwright/test";
import { seedGuestState, waitForBackAnchor } from "./support/guest-mode";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsIntersect(a: Rect, b: Rect, tolerance = 1): boolean {
  return (
    a.x + tolerance < b.x + b.width &&
    a.x + a.width - tolerance > b.x &&
    a.y + tolerance < b.y + b.height &&
    a.y + a.height - tolerance > b.y
  );
}

function formatRect(r: Rect): string {
  return `[x:${r.x.toFixed(1)}, y:${r.y.toFixed(1)}, w:${r.width.toFixed(1)}, h:${r.height.toFixed(1)}]`;
}

async function waitForStableBox(locator: Locator): Promise<Rect | null> {
  const count = await locator.count();
  if (count === 0) return null;
  const el = locator.first();
  if (!(await el.isVisible())) return null;

  let prevY: number | null = null;
  for (let i = 0; i < 20; i++) {
    const box = await el.boundingBox();
    if (box && prevY !== null && Math.abs(box.y - prevY) < 0.5) {
      return box;
    }
    prevY = box ? box.y : null;
    await new Promise((r) => setTimeout(r, 50));
  }
  return el.boundingBox();
}

async function getVisibleBox(
  locator: Locator,
  measureChild = false,
): Promise<Rect | null> {
  const count = await locator.count();
  if (count === 0) return null;
  const el = locator.first();
  if (!(await el.isVisible())) return null;

  // Banners publish their testid on the full-viewport wrapper (fixed
  // inset-x-0, pointer-events-none); the visible card is a direct child.
  // Overlays whose testid is already on the card (FAB, FloatingTimer,
  // MobileNav) measure themselves.
  let target = el;
  if (measureChild) {
    const innerCard = el.locator("> div");
    if (
      (await innerCard.count()) > 0 &&
      (await innerCard.first().isVisible())
    ) {
      target = innerCard.first();
    }
  }

  return waitForStableBox(target);
}

async function setupPageOverlays(
  page: Page,
  options: {
    viewport: { width: number; height: number };
    route?: string;
    offline?: boolean;
    showTelemetryPrompt?: boolean;
    startTimer?: boolean;
    hasDemoData?: boolean;
  },
) {
  const {
    viewport,
    route = "/",
    offline = false,
    showTelemetryPrompt = true,
    startTimer = true,
    hasDemoData = true,
  } = options;

  await page.setViewportSize(viewport);

  await page.addInitScript(
    ({ prompt, demo, timer }) => {
      if (prompt) {
        localStorage.setItem("telemetry_first_action", "true");
        localStorage.setItem("kanso_telemetry_first_action", "true");
        localStorage.removeItem("telemetry_consent");
      } else {
        localStorage.setItem("telemetry_consent", "denied");
      }
      if (!demo) {
        localStorage.setItem(
          "kanso_guest_data_v11",
          JSON.stringify({
            tasks: [],
            subtasks: [],
            habits: [],
            habit_entries: [],
            seed_ids: [],
          }),
        );
      }
      if (timer) {
        localStorage.setItem(
          "kanso-timer-storage",
          JSON.stringify({
            state: {
              state: {
                mode: "focus",
                isRunning: true,
                remainingSeconds: 1500,
                completedSessions: 0,
                activeTaskId: null,
                endsAt: Date.now() + 1500 * 1000,
                sourceDeviceId: null,
              },
              settings: {
                focusDuration: 25,
                shortBreakDuration: 5,
                longBreakDuration: 15,
                sessionsBeforeLongBreak: 4,
              },
            },
            version: 1,
          }),
        );
      }
    },
    { prompt: showTelemetryPrompt, demo: hasDemoData, timer: startTimer },
  );

  await seedGuestState(page, "http://localhost:3000");

  await page.goto(route, {
    waitUntil: "domcontentloaded",
  });

  if (route !== "/") {
    await waitForBackAnchor(page, route);
  }

  if (startTimer && viewport.width >= 768) {
    await expect(page.locator('[data-testid="floating-timer"]')).toBeVisible({
      timeout: 10000,
    });
  }

  if (offline) {
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible(
      {
        timeout: 5000,
      },
    );
    await page.context().setOffline(true);
  }

  if (showTelemetryPrompt) {
    await expect(
      page.locator('[data-testid="telemetry-consent-prompt"]'),
    ).toBeVisible({ timeout: 5000 });
  }

  await page.waitForFunction(() => typeof window.__notify === "function");
  await page.evaluate(() => {
    window.__notify?.("Task completed and archived from today's list", {
      duration: 60_000,
      action: { label: "Undo", onClick: () => {} },
    });
    window.__notify?.("Weekly backup reminder: download your copy now", {
      duration: 60_000,
      action: { label: "Backup", onClick: () => {} },
    });
  });

  const toastsLocator = page.locator("[data-sonner-toast]");
  await expect(toastsLocator).toHaveCount(2, { timeout: 10000 });
}

async function assertAllBottomOverlaysDoNotIntersect(page: Page) {
  const toastsLocator = page.locator("[data-sonner-toast]");
  await expect(toastsLocator).toHaveCount(2);

  const toasts: { name: string; box: Rect }[] = [];

  const toastCount = await toastsLocator.count();
  for (let i = 0; i < toastCount; i++) {
    const box = await waitForStableBox(toastsLocator.nth(i));
    if (box) toasts.push({ name: `Toast #${i}`, box });
  }

  const staticOverlays: {
    name: string;
    locator: Locator;
    measureChild?: boolean;
  }[] = [
    { name: "FAB", locator: page.locator('[data-testid="fab"]') },
    {
      name: "FloatingTimer",
      locator: page.locator('[data-testid="floating-timer"]'),
    },
    {
      name: "DemoBar",
      locator: page.locator('[data-testid="demo-bar"]'),
      measureChild: true,
    },
    {
      name: "OfflineIndicator",
      locator: page.locator('[data-testid="offline-indicator"]'),
      measureChild: true,
    },
    {
      name: "TelemetryConsentPrompt",
      locator: page.locator('[data-testid="telemetry-consent-prompt"]'),
      measureChild: true,
    },
    {
      name: "MobileNav",
      locator: page.locator("nav.fixed.bottom-0"),
    },
  ];

  const resolvedStatic: { name: string; box: Rect }[] = [];
  for (const item of staticOverlays) {
    const box = await getVisibleBox(item.locator, item.measureChild);
    if (box) resolvedStatic.push({ name: item.name, box });
  }

  const collisions: string[] = [];

  const recordCollision = (
    a: { name: string; box: Rect },
    b: { name: string; box: Rect },
  ) => {
    collisions.push(
      `${a.name} ${formatRect(a.box)} intersects with ${b.name} ${formatRect(b.box)}`,
    );
  };

  for (const toast of toasts) {
    for (const staticItem of resolvedStatic) {
      if (rectsIntersect(toast.box, staticItem.box)) {
        recordCollision(toast, staticItem);
      }
    }
  }

  for (let i = 0; i < resolvedStatic.length; i++) {
    for (let j = i + 1; j < resolvedStatic.length; j++) {
      const a = resolvedStatic[i];
      const b = resolvedStatic[j];
      const isMobileFabPrompt =
        (a.name === "FAB" && b.name === "TelemetryConsentPrompt") ||
        (a.name === "TelemetryConsentPrompt" && b.name === "FAB");
      if (isMobileFabPrompt) continue;

      if (rectsIntersect(a.box, b.box)) {
        recordCollision(a, b);
      }
    }
  }

  expect(collisions, collisions.join("\n")).toEqual([]);
}

test.describe("Bottom overlays overlap suite", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Chromium project only (WebKit requires Docker on this machine)",
  );

  test.describe("Desktop (1280x800)", () => {
    test("toasts do not intersect overlays at 1280x800", async ({ page }) => {
      await setupPageOverlays(page, {
        viewport: { width: 1280, height: 800 },
        route: "/",
        showTelemetryPrompt: true,
        startTimer: true,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });

    test("offline: toasts do not intersect offline indicator at 1280x800", async ({
      page,
    }) => {
      await setupPageOverlays(page, {
        viewport: { width: 1280, height: 800 },
        route: "/",
        offline: true,
        showTelemetryPrompt: true,
        startTimer: true,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });
  });

  test.describe("Tablet / narrow band (700x900)", () => {
    test("toasts do not overlap mobile nav on 600-767px band", async ({
      page,
    }) => {
      await setupPageOverlays(page, {
        viewport: { width: 700, height: 900 },
        route: "/",
        showTelemetryPrompt: false,
        startTimer: true,
        hasDemoData: false,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });

    test("all overlays active at 700x900 do not intersect", async ({
      page,
    }) => {
      await setupPageOverlays(page, {
        viewport: { width: 700, height: 900 },
        route: "/",
        showTelemetryPrompt: true,
        startTimer: true,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });
  });

  test.describe("Mobile phone (390x844)", () => {
    const routes = [
      { name: "Tasks (/)", path: "/" },
      { name: "Habits (/habits)", path: "/habits" },
      { name: "Calendar (/calendar)", path: "/calendar" },
    ];

    for (const { name, path } of routes) {
      test(`toasts do not intersect FAB or mobile nav on ${name}`, async ({
        page,
      }) => {
        await setupPageOverlays(page, {
          viewport: { width: 390, height: 844 },
          route: path,
          showTelemetryPrompt: false,
          startTimer: true,
        });

        await assertAllBottomOverlaysDoNotIntersect(page);
      });
    }

    test("all overlays active at 390x844 do not intersect", async ({
      page,
    }) => {
      await setupPageOverlays(page, {
        viewport: { width: 390, height: 844 },
        route: "/",
        showTelemetryPrompt: true,
        startTimer: true,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });

    test("offline: overlays at 390x844 do not intersect", async ({ page }) => {
      await setupPageOverlays(page, {
        viewport: { width: 390, height: 844 },
        route: "/",
        offline: true,
        showTelemetryPrompt: true,
        startTimer: true,
      });

      await assertAllBottomOverlaysDoNotIntersect(page);
    });

    test("swipe-to-dismiss dismisses the front toast on the collapsed stack", async ({
      page,
    }) => {
      await setupPageOverlays(page, {
        viewport: { width: 390, height: 844 },
        route: "/",
        showTelemetryPrompt: false,
        startTimer: false,
      });

      const toasts = page.locator("[data-sonner-toast]");
      await expect(toasts).toHaveCount(2);

      const frontToast = toasts.first();
      const box = await frontToast.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width + 100, box.y + box.height / 2, {
          steps: 5,
        });
        await page.mouse.up();
      }

      await expect(toasts).toHaveCount(1, { timeout: 5000 });
    });
  });
});
