import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

async function openNewTaskViaShortcut(page: Page) {
  await expect(async () => {
    await page.keyboard.press("n");
    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });
}

test.describe("Task Quick Add NLP, Rapid Capture & Matte Surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("1. do_date vs due_date parsing & clean title stripping", async ({
    page,
  }) => {
    // 1a: "Call dentist tomorrow" -> Do Date
    await openNewTaskViaShortcut(page);
    const input = page.locator("#task-content");
    await input.fill("Call dentist tomorrow");

    // NLP chip should appear with "Do: Tomorrow"
    const doChip = page.getByTestId("task-nlp-chip");
    await expect(doChip).toBeVisible();
    await expect(doChip).toContainText("Do: Tomorrow");

    // Submit via Enter
    await input.press("Enter");
    await expect(
      page.getByRole("heading", { name: "New Task" }),
    ).not.toBeVisible();

    // Verify saved task title is stripped cleanly: "Call dentist"
    const dentistTask = page
      .getByTestId("task-list-container")
      .getByText("Call dentist", { exact: true });
    await expect(dentistTask).toBeVisible();

    // Reopen task and verify Do Date is set to Tomorrow
    await dentistTask.click();
    await expect(
      page.getByRole("button", { name: /^Do Date:/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // 1b: "Submit report by Friday" -> Due Date
    await openNewTaskViaShortcut(page);
    const input2 = page.locator("#task-content");
    await input2.fill("Submit report by Friday");

    // NLP chip should appear with "Due: Fri"
    const dueChip = page.getByTestId("task-nlp-chip");
    await expect(dueChip).toBeVisible();
    await expect(dueChip).toContainText("Due: Fri");

    // Submit via Enter
    await input2.press("Enter");
    await expect(
      page.getByRole("heading", { name: "New Task" }),
    ).not.toBeVisible();

    // Verify saved task title is stripped cleanly: "Submit report"
    const reportTask = page
      .getByTestId("task-list-container")
      .getByText("Submit report", { exact: true });
    await expect(reportTask).toBeVisible();

    // Reopen task and verify Due Date is set
    await reportTask.click();
    await expect(
      page.getByRole("button", { name: /^Due Date:/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("2. False-positive dismissal & empty title safety guard", async ({
    page,
  }) => {
    // 2a: "Read 1984" -> should NOT trigger chip
    await openNewTaskViaShortcut(page);
    const input = page.locator("#task-content");
    await input.fill("Read 1984");
    await expect(page.getByTestId("task-nlp-chip")).not.toBeVisible();

    // 2b: "Tomorrow" alone -> should NOT trigger chip or wipe title
    await input.clear();
    await input.fill("Tomorrow");
    await expect(page.getByTestId("task-nlp-chip")).not.toBeVisible();
    await expect(input).toHaveValue("Tomorrow");

    // 2c: "Check June invoice" -> triggers chip, dismiss with x, confirm verbatim save
    await input.clear();
    await input.fill("Check June invoice");
    const chip = page.getByTestId("task-nlp-chip");
    await expect(chip).toBeVisible();

    // Click dismissal x button
    const dismissBtn = page.getByTestId("task-nlp-chip-dismiss");
    await dismissBtn.click();
    await expect(chip).not.toBeVisible();

    // Submit task
    await input.press("Enter");
    await expect(
      page.getByRole("heading", { name: "New Task" }),
    ).not.toBeVisible();

    // Verify verbatim save: "Check June invoice"
    const juneTask = page
      .getByTestId("task-list-container")
      .getByText("Check June invoice", { exact: true });
    await expect(juneTask).toBeVisible();

    // Reopen and verify no date was set
    await juneTask.click();
    await expect(
      page.getByRole("button", { name: "Set do date" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set due date" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("3. Rapid capture with Shift+Enter vs plain Enter", async ({ page }) => {
    await openNewTaskViaShortcut(page);
    const input = page.locator("#task-content");

    // Type first task and press Shift+Enter
    await input.fill("Rapid task 1");
    await input.press("Shift+Enter");

    // Modal stays open, fields are cleared, input remains focused
    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();

    // Type second task and press Shift+Enter
    await input.fill("Rapid task 2");
    await input.press("Shift+Enter");

    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();

    // Type third task and press plain Enter -> should save and close
    await input.fill("Rapid task 3");
    await input.press("Enter");

    await expect(
      page.getByRole("heading", { name: "New Task" }),
    ).not.toBeVisible();

    // Verify all 3 tasks were saved
    await expect(
      page
        .getByTestId("task-list-container")
        .getByText("Rapid task 1", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("task-list-container")
        .getByText("Rapid task 2", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("task-list-container")
        .getByText("Rapid task 3", { exact: true }),
    ).toBeVisible();
  });

  test("4. Matte surface check (Light and Dark mode screenshots)", async ({
    page,
  }) => {
    // 4a. Light mode: open task view and capture property strip
    await openNewTaskViaShortcut(page);
    const strip = page.getByTestId("property-strip");
    await expect(strip).toBeVisible();

    await page.screenshot({
      path: "/home/achyuth/.gemini/antigravity-cli/brain/a5b81a1c-6537-473e-b1f2-6bd9a6c3cbf2/taskview-light.png",
      fullPage: false,
    });

    // Close task sheet
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "New Task" }),
    ).not.toBeVisible();

    // 4b. Dark mode: switch theme
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });

    await openNewTaskViaShortcut(page);
    await expect(page.getByTestId("property-strip")).toBeVisible();

    await page.screenshot({
      path: "/home/achyuth/.gemini/antigravity-cli/brain/a5b81a1c-6537-473e-b1f2-6bd9a6c3cbf2/taskview-dark.png",
      fullPage: false,
    });
  });
});
