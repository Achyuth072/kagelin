import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

// GlobalHotkeys attaches after hydration, which can land after
// domcontentloaded — retry instead of racing a fixed sleep.
async function openNewTaskViaShortcut(page: Page) {
  await expect(async () => {
    await page.keyboard.press("n");
    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });
}

test.describe("Task Creation (Guest Mode)", () => {
  test.beforeEach(async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("should create a new task successfully via shortcut", async ({
    page,
  }) => {
    const taskContent = `Test Task ${Date.now()}`;
    await openNewTaskViaShortcut(page);
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(
      page.getByTestId("task-list-container").getByText(taskContent),
    ).toBeVisible();
  });

  test("should have disabled submit button when content is empty", async ({
    page,
  }) => {
    await openNewTaskViaShortcut(page);

    const createBtn = page.getByRole("button", { name: /create task/i });

    await expect(createBtn).toBeDisabled();

    const input = page.getByPlaceholder("What needs to be done?");
    await input.fill("a");
    await expect(createBtn).toBeEnabled();
    await input.fill("");
    await expect(createBtn).toBeDisabled();
  });

  test("should create task with steps and persist them on submit", async ({
    page,
  }) => {
    const taskContent = `Task with Steps ${Date.now()}`;
    await openNewTaskViaShortcut(page);
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);

    // Open steps panel
    await page.getByRole("button", { name: /(subtasks|steps)/i }).click();

    // Add two steps via Enter
    const stepInput = page.getByPlaceholder("Add a step...");
    await stepInput.fill("Step One");
    await stepInput.press("Enter");
    await stepInput.fill("Step Two");
    await stepInput.press("Enter");

    // Submit task
    await page.getByRole("button", { name: /create task/i }).click();

    // Reopen task from list to verify steps were saved
    const taskRow = page
      .getByTestId("task-list-container")
      .getByText(taskContent);
    await expect(taskRow).toBeVisible();
    await taskRow.click();

    // Steps should be visible in edit sheet
    await expect(page.getByText("Step One")).toBeVisible();
    await expect(page.getByText("Step Two")).toBeVisible();
  });

  test("should auto-flush uncommitted step text when saving task", async ({
    page,
  }) => {
    const taskContent = `Task with Uncommitted Step ${Date.now()}`;
    await openNewTaskViaShortcut(page);
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);

    // Open steps panel and type step without pressing Enter
    await page.getByRole("button", { name: /(subtasks|steps)/i }).click();
    await page.getByPlaceholder("Add a step...").fill("Auto-flushed step");

    // Submit task directly
    await page.getByRole("button", { name: /create task/i }).click();

    // Reopen task from list to verify uncommitted step was flushed & saved
    const taskRow = page
      .getByTestId("task-list-container")
      .getByText(taskContent);
    await expect(taskRow).toBeVisible();
    await taskRow.click();

    await expect(page.getByText("Auto-flushed step")).toBeVisible();
  });
});
