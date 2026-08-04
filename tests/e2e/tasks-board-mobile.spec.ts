import { test, expect, type Page } from "@playwright/test";

/**
 * Board view at a phone viewport — see ADR 0007. Columns are 85vw, so a card
 * only reaches the next column via edge auto-scroll, which needs the board to
 * actually overflow.
 *
 * Aimed at mobile-webkit: Chromium tolerated snap during a drag when this was
 * written, so the snap assertion pins the decision rather than a reproduced bug.
 */

const GUEST_DATA_KEY = "kanso_guest_data_v11";
const UI_KEY = "kanso-ui-state";
const BOARD = '[data-testid="task-board-container"]';

function buildGuestData(taskCount: number) {
  const iso = new Date().toISOString();
  return {
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      user_id: "guest",
      content: `Task ${i}`,
      description: null,
      is_completed: false,
      completed_at: null,
      priority: 4,
      project_id: null,
      day_order: i,
      created_at: iso,
      updated_at: iso,
      due_date: null,
      do_date: null,
      is_evening: false,
      parent_id: null,
      recurrence: null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
    })),
    projects: [],
    habits: [],
    habit_entries: [],
    focus_logs: [],
    events: [],
    lastUpdated: iso,
  };
}

async function bootstrap(page: Page, viewMode: "board" | "list") {
  await page.context().addCookies([
    {
      name: "kanso_guest_mode",
      value: "true",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.addInitScript(
    ([dataKey, uiKey, data, mode]) => {
      localStorage.setItem("kanso_guest_mode", "true");
      localStorage.setItem(dataKey as string, JSON.stringify(data));
      localStorage.setItem(
        uiKey as string,
        JSON.stringify({
          state: { viewMode: mode, groupBy: "none", sortBy: "custom" },
          version: 1,
        }),
      );
    },
    [GUEST_DATA_KEY, UI_KEY, buildGuestData(6), viewMode] as const,
  );

  await page.goto("/");
}

test.describe("Tasks board on mobile", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) > 500,
    "mobile viewport only",
  );

  test("Board is reachable from the view switcher", async ({ page }) => {
    await bootstrap(page, "list");

    const boardTab = page.getByRole("tab", { name: /board/i });
    await expect(boardTab).toBeVisible({ timeout: 15000 });

    await boardTab.click();
    await expect(page.locator(BOARD)).toBeVisible();
  });

  test("renders both fallback columns when Evening is empty", async ({
    page,
  }) => {
    await bootstrap(page, "board");
    await expect(page.locator(BOARD)).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("heading", { name: /^Tasks/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^This Evening/ }),
    ).toBeVisible();
  });

  test("suspends scroll-snap while a card is being dragged", async ({
    page,
  }) => {
    await bootstrap(page, "board");
    const board = page.locator(BOARD);
    await expect(board).toBeVisible({ timeout: 15000 });

    await expect(board).toHaveClass(/snap-mandatory/);

    const card = page.getByText("Task 0", { exact: true }).first();
    const box = await card.boundingBox();
    if (!box) throw new Error("no bounding box for Task 0");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Cross the 5px activation distance.
    await page.mouse.move(cx + 12, cy, { steps: 4 });

    await expect(board).not.toHaveClass(/snap-mandatory/);

    await page.mouse.up();
    await expect(board).toHaveClass(/snap-mandatory/);
  });

  test("auto-scrolls toward the next column during a cross-column drag", async ({
    page,
  }) => {
    await bootstrap(page, "board");
    const board = page.locator(BOARD);
    await expect(board).toBeVisible({ timeout: 15000 });

    const startScroll = await board.evaluate((el) => el.scrollLeft);

    const card = page.getByText("Task 0", { exact: true }).first();
    const box = await card.boundingBox();
    if (!box) throw new Error("no bounding box for Task 0");
    const cy = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 12, cy, { steps: 4 });

    // Hold at the edge to engage auto-scroll.
    const width = page.viewportSize()?.width ?? 360;
    await page.mouse.move(width - 6, cy, { steps: 10 });
    await page.waitForTimeout(800);

    const draggingScroll = await board.evaluate((el) => el.scrollLeft);
    await page.mouse.up();

    expect(draggingScroll).toBeGreaterThan(startScroll);
  });
});
