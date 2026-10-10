import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

const STORE_KEY = "kanso_guest_data_v11";
const CARD_KEY = "startHere:guest";

const existingTask = {
  id: "existing-task",
  user_id: "guest",
  project_id: null,
  parent_id: null,
  content: "Already here",
  description: null,
  priority: 4,
  due_date: null,
  do_date: null,
  is_evening: false,
  is_completed: false,
  completed_at: null,
  day_order: 0,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// Seed once so page reloads preserve test state.
async function seedGuest(
  page: Page,
  { tasks = [] as unknown[], card = null as unknown } = {},
) {
  await page.addInitScript(
    ({ storeKey, cardKey, tasks, card }) => {
      if (localStorage.getItem(storeKey)) return;
      localStorage.setItem(
        storeKey,
        JSON.stringify({
          tasks,
          projects: [],
          habits: [],
          habit_entries: [],
          focus_logs: [],
          events: [],
          lastUpdated: new Date().toISOString(),
          seed_ids: [],
        }),
      );
      if (card) localStorage.setItem(cardKey, JSON.stringify(card));
    },
    { storeKey: STORE_KEY, cardKey: CARD_KEY, tasks, card },
  );
  await openHome(page);
}

// Dev-server hydration under parallel workers can exceed the 5s default.
async function openHome(page: Page) {
  await seedGuestMode(page, "http://localhost:3000/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 25_000,
  });
}

test.describe("Start here card", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Desktop layout; WebKit needs Docker on this machine",
  );

  test("shows on an empty account and ticks a step after adding a task", async ({
    page,
  }) => {
    await seedGuest(page);
    const card = page.getByRole("region", { name: "Start here" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /^Done:/ })).toHaveCount(0);

    // The click handler attaches after hydration — retry instead of racing.
    await expect(async () => {
      await card.getByRole("button", { name: /Add a task/ }).click();
      await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible(
        { timeout: 1000 },
      );
    }).toPass({ timeout: 10_000 });
    await page.getByPlaceholder("What needs to be done?").fill("First task");
    await page.getByRole("button", { name: /create task/i }).click();

    await expect(
      card.getByRole("button", { name: /^Done: Add a task/ }),
    ).toBeVisible();
  });

  test("stays dismissed after a reload", async ({ page }) => {
    await seedGuest(page);
    const card = page.getByRole("region", { name: "Start here" });

    await expect(async () => {
      await card.getByRole("button", { name: "Dismiss" }).click();
      await expect(card).toBeHidden({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    // Ensure queries have settled before asserting the card remains hidden.
    await expect(
      page.getByText("Write down what you need to do.", { exact: false }),
    ).toBeVisible();
    await expect(card).toBeHidden();
  });

  test("a step stays done after its data goes away", async ({ page }) => {
    await seedGuest(page, {
      card: { eligible: true, dismissed: false, done: ["task"] },
    });
    const card = page.getByRole("region", { name: "Start here" });
    await expect(
      card.getByRole("button", { name: /^Done: Add a task/ }),
    ).toBeVisible();
  });

  test("never shows for an account that already has data", async ({ page }) => {
    await seedGuest(page, { tasks: [existingTask] });
    await expect(page.getByText("Already here")).toBeVisible();
    await expect(page.getByRole("region", { name: "Start here" })).toBeHidden();
  });

  test("shows after Start fresh for a guest who began in demo mode", async ({
    page,
  }) => {
    await openHome(page);
    // ~700 demo tasks load slowly when workers share the dev server.
    const demoBar = page.getByTestId("demo-bar");
    await expect(demoBar).toBeVisible({ timeout: 25_000 });

    await demoBar.getByRole("button", { name: "Start fresh" }).click();
    await page.getByPlaceholder("Type 'delete'...").fill("delete");
    await page.getByRole("button", { name: "Delete Account Data" }).click();

    const card = page.getByRole("region", { name: "Start here" });
    await expect(card).toBeVisible({ timeout: 25_000 });
    await expect(card.getByRole("button", { name: /^Done:/ })).toHaveCount(0);
  });

  test("is hidden while the guest demo data is loaded", async ({ page }) => {
    await openHome(page);
    await expect(page.getByTestId("demo-bar")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("region", { name: "Start here" })).toBeHidden();
  });
});
