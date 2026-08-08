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
});
