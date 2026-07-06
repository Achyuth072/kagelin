import { test, expect, type Page } from "@playwright/test";

/**
 * DnD frame-drop measurement loop (diagnosing-bugs Phase 1).
 *
 * Seeds a controlled guest-mode dataset via localStorage BEFORE the app boots
 * (MockStore reads localStorage in its constructor), forces the board view,
 * instruments the page with a requestAnimationFrame frame-gap sampler + a
 * longtask PerformanceObserver, then drives a scripted drag and reports:
 *   - fps         : frames rendered / drag duration (higher = smoother)
 *   - longFrames  : frame intervals > 32ms (a dropped 60Hz frame)
 *   - maxGapMs    : worst single frame interval
 *   - blockingMs  : total longtask time during the drag (main-thread jank)
 *   - dragOvers   : number of onDragOver reorders the app processed
 *
 * Run against a PRODUCTION build (npm run build && npm start) so the React
 * Compiler is applied and there is no StrictMode double-render.
 */

const GUEST_DATA_KEY = "kanso_guest_data_v10";
const UI_KEY = "kanso-ui-state";

type ViewCfg = {
  viewMode: "board" | "list" | "grid";
  groupBy: "none" | "project" | "date" | "priority";
  sortBy: string;
};

function buildGuestData(projects: number, tasksPerProject: number) {
  const now = new Date();
  const iso = now.toISOString();
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  const dueIso = due.toISOString();

  const projectRows: unknown[] = [];
  const tasks: unknown[] = [];
  let order = 0;
  for (let p = 0; p < projects; p++) {
    const pid = `proj-${p}`;
    projectRows.push({
      id: pid,
      user_id: "guest",
      name: `Proj ${p}`,
      color: "#4B6CB7",
      view_style: "board",
      is_inbox: false,
      is_archived: false,
      created_at: iso,
      updated_at: iso,
    });
    for (let t = 0; t < tasksPerProject; t++) {
      tasks.push({
        id: `task-${p}-${t}`,
        user_id: "guest",
        content: `Task ${p}-${t}`,
        description: null,
        is_completed: false,
        completed_at: null,
        priority: 4,
        project_id: pid,
        day_order: order++,
        created_at: iso,
        updated_at: iso,
        due_date: dueIso,
        do_date: null,
        is_evening: false,
        parent_id: null,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
      });
    }
  }
  return {
    tasks,
    projects: projectRows,
    habits: [],
    habit_entries: [],
    focus_logs: [],
    events: [],
    lastUpdated: iso,
  };
}

async function bootstrap(
  page: Page,
  guestData: unknown,
  ui: ViewCfg,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "kanso_guest_mode",
      value: "true",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.addInitScript(
    ([dataKey, uiKey, data, uiCfg]) => {
      localStorage.setItem("kanso_guest_mode", "true");
      localStorage.setItem(dataKey as string, JSON.stringify(data));
      localStorage.setItem(
        uiKey as string,
        JSON.stringify({ state: uiCfg, version: 0 }),
      );

      // Frame-gap sampler + longtask observer, installed before app scripts.
      const perf = {
        frames: [] as number[],
        longtasks: [] as { start: number; duration: number }[],
      };
      (window as unknown as { __perf: typeof perf }).__perf = perf;
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            perf.longtasks.push({ start: e.startTime, duration: e.duration });
          }
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch {
        /* longtask unsupported */
      }
      const tick = (t: number) => {
        perf.frames.push(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [GUEST_DATA_KEY, UI_KEY, guestData, ui] as const,
  );

  await page.goto("/");
  await expect(
    page.locator('[data-testid="task-board-container"]'),
  ).toBeVisible({ timeout: 15000 });

  // Throttle the CPU to a mid-tier-device profile so the main-thread cost of
  // each onDragOver becomes visible as dropped frames (headless Chromium on a
  // fast host otherwise absorbs it). This is what real users feel.
  const cpuRate = Number(process.env.CPU_THROTTLE || "6");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
}

type Metrics = {
  label: string;
  durationMs: number;
  frames: number;
  fps: number;
  longFrames: number;
  maxGapMs: number;
  blockingMs: number;
  longtaskCount: number;
};

async function measureDrag(
  page: Page,
  label: string,
  drag: () => Promise<void>,
): Promise<Metrics> {
  const t0 = await page.evaluate(() => performance.now());
  await drag();
  const t1 = await page.evaluate(() => performance.now());

  const raw = await page.evaluate(() => {
    const p = (
      window as unknown as {
        __perf: {
          frames: number[];
          longtasks: { start: number; duration: number }[];
        };
      }
    ).__perf;
    return { frames: p.frames.slice(), longtasks: p.longtasks.slice() };
  });

  const inWin = raw.frames.filter((t) => t >= t0 && t <= t1);
  const gaps: number[] = [];
  for (let i = 1; i < inWin.length; i++) gaps.push(inWin[i] - inWin[i - 1]);
  const longFrames = gaps.filter((g) => g > 32).length;
  const maxGapMs = gaps.length ? Math.max(...gaps) : 0;
  const durationMs = t1 - t0;

  let blockingMs = 0;
  let longtaskCount = 0;
  for (const lt of raw.longtasks) {
    const s = Math.max(lt.start, t0);
    const e = Math.min(lt.start + lt.duration, t1);
    if (e > s) {
      blockingMs += e - s;
      longtaskCount++;
    }
  }

  return {
    label,
    durationMs: Math.round(durationMs),
    frames: inWin.length,
    fps: +((inWin.length / durationMs) * 1000).toFixed(1),
    longFrames,
    maxGapMs: Math.round(maxGapMs),
    blockingMs: Math.round(blockingMs),
    longtaskCount,
  };
}

/**
 * Drives a slow, deterministic drag: press on `card`, cross the 5px activation
 * threshold, then step the pointer downward `steps` times pausing ~1 frame
 * between each move so the app's onDragOver reorders run under realistic pacing.
 */
async function dragDown(
  page: Page,
  cardText: string,
  totalDy: number,
  steps: number,
  extraX = 0,
): Promise<void> {
  const card = page.getByText(cardText, { exact: true }).first();
  const box = await card.boundingBox();
  if (!box) throw new Error(`no box for ${cardText}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 8, { steps: 2 }); // pass activation constraint
  for (let i = 1; i <= steps; i++) {
    const y = cy + 8 + (totalDy * i) / steps;
    const x = cx + (extraX * i) / steps;
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
}

test.describe("DnD frame-drop measurement", () => {
  test("A: same-board reorder (single dense column, 40 tasks)", async ({
    page,
  }) => {
    await bootstrap(page, buildGuestData(1, 40), {
      viewMode: "board",
      groupBy: "none",
      sortBy: "custom",
    });
    // Single "Tasks" column. Drag the top card down through the column.
    const m = await measureDrag(page, "same-board", () =>
      dragDown(page, "Task 0-0", 380, 26),
    );
    console.log("DND-PERF", JSON.stringify(m));
    expect(m.fps).toBeGreaterThan(0);
  });

  test("B: cross-board then down (2 columns x 20 tasks)", async ({ page }) => {
    await bootstrap(page, buildGuestData(2, 20), {
      viewMode: "board",
      groupBy: "project",
      sortBy: "custom",
    });
    // Drag a card from column 0 across into column 1 (extraX), then down it.
    const m = await measureDrag(page, "cross-board", () =>
      dragDown(page, "Task 0-2", 360, 26, 340),
    );
    console.log("DND-PERF", JSON.stringify(m));
    expect(m.fps).toBeGreaterThan(0);
  });
});
