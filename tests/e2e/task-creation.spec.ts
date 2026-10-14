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
    const input = page.getByPlaceholder("What needs to be done?");
    await input.clear();

    await expect(createBtn).toBeDisabled();

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

    // Edit sheet opens with the steps section collapsed
    await page.getByRole("button", { name: /subtasks/i }).click();
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

    await page.getByRole("button", { name: /subtasks/i }).click();
    await expect(page.getByText("Auto-flushed step")).toBeVisible();
  });

  test("should display recurrence UI in edit view when task repeats", async ({
    page,
  }) => {
    const taskContent = `Recurring Task ${Date.now()}`;
    await openNewTaskViaShortcut(page);
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);

    // Set recurrence to Daily
    await page.getByTitle("Does not repeat").click();
    await page.getByRole("button", { name: "Daily", exact: true }).click();
    await expect(page.getByTitle("Daily")).toBeVisible();

    // Create task
    await page.getByRole("button", { name: /create task/i }).click();

    // Reopen task from list to edit it
    const taskRow = page
      .getByTestId("task-list-container")
      .getByText(taskContent);
    await expect(taskRow).toBeVisible();
    await taskRow.click();

    // Recurrence UI in edit view must show Daily with badge D
    const recurrenceBtn = page.getByTitle("Daily");
    await expect(recurrenceBtn).toBeVisible();
    await expect(recurrenceBtn).toContainText("D");

    // Change recurrence to Weekly inside the edit view
    await recurrenceBtn.click();
    await page.getByRole("button", { name: "Weekly", exact: true }).click();
    await expect(page.getByTitle("Weekly")).toBeVisible();

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Reopen task again to verify updated recurrence was persisted
    await taskRow.click();
    const weeklyBtn = page.getByTitle("Weekly");
    await expect(weeklyBtn).toBeVisible();
    await expect(weeklyBtn).toContainText("W");
  });

  test("should create task with inline notes and render clickable URLs on reopen", async ({
    page,
  }) => {
    const taskContent = `Task with Notes ${Date.now()}`;
    await openNewTaskViaShortcut(page);
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);

    // Fill inline notes with a plain URL
    const notesInput = page.getByPlaceholder("Add notes");
    await expect(notesInput).toBeVisible();
    await notesInput.fill("Check reference: https://example.com/docs");

    // Submit task
    await page.getByRole("button", { name: /create task/i }).click();

    // Reopen task from list to verify notes & clickable link
    const taskRow = page
      .getByTestId("task-list-container")
      .getByText(taskContent);
    await expect(taskRow).toBeVisible();
    await taskRow.click();

    // The note is rendered inline with a clickable link
    const link = page.getByRole("link", { name: "https://example.com/docs" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://example.com/docs");
    await expect(link).toHaveAttribute("target", "_blank");

    // Click non-link note text to edit
    await page
      .getByRole("button", { name: "Edit notes" })
      .click({ position: { x: 5, y: 5 } });
    const editNotesInput = page.getByPlaceholder("Add notes");
    await expect(editNotesInput).toBeVisible();
    await editNotesInput.fill("Updated note text");

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Reopen task again to verify updated notes persisted
    await taskRow.click();
    await expect(
      page.getByRole("button", { name: "Edit notes" }),
    ).toContainText("Updated note text");
  });
});
