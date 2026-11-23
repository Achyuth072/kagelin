import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode } from "../support/guest-mode";

const SYNTHETIC_TICKTICK_CSV = `"TickTick Backup",,,,,,
"Export Date: 2026-11-23",,,,,,
"Version: 6.0",,,,,,
,,,,,,
"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"
"","Inbox","Synthetic TickTick Root Task","work,test","Detailed content","0","","2026-11-25T17:00:00+0000","","","5","0","2026-11-20T10:00:00+0000","","0","UTC","1","0","","0","list","tt-root-1",""
"","Inbox","Synthetic TickTick Subtask","","Subtask note","0","","2026-11-25T17:00:00+0000","","","3","0","2026-11-20T10:05:00+0000","","1","UTC","1","0","","0","list","tt-sub-1","tt-root-1"
"Personal","Groceries","Buy groceries","shopping","▫ [ ] Fresh Apples\\n▫ [x] Ripe Oranges","1","","2026-11-26T17:00:00+0000","","","0","0","2026-11-20T10:10:00+0000","","0","UTC","1","0","","0","list","tt-root-2",""
"Personal","Groceries","Completed Grocery Item","","Done earlier","0","","2026-11-22T17:00:00+0000","","","1","2","2026-11-20T10:15:00+0000","2026-11-22T12:00:00+0000","1","UTC","1","0","","0","list","tt-root-3",""
`;

async function openAppMigrationDialog(page: Page) {
  const dismiss = page.getByRole("button", { name: /no thanks/i });
  if (await dismiss.count()) {
    await dismiss.first().click();
  }

  const migrationButton = page.getByRole("button", {
    name: /third-party app migration/i,
  });
  await expect(migrationButton).toBeVisible({ timeout: 10_000 });
  await migrationButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText("App Migration")).toBeVisible();
  return dialog;
}

test.describe("TickTick Migration E2E (Guest Mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seedGuestMode(page, "http://localhost:3000/settings?tab=account");
  });

  test("uploads synthetic TickTick backup, verifies metrics, and commits import to board", async ({
    page,
  }) => {
    await openAppMigrationDialog(page);

    const tickTickCard = page.getByRole("button", {
      name: "Import TickTick tasks from backup CSV",
    });
    await expect(tickTickCard).toBeVisible();
    await expect(tickTickCard.getByText("TickTick")).toBeVisible();

    const fileInput = page.getByLabel("Upload TickTick backup CSV file");
    await fileInput.setInputFiles({
      name: "TickTickBackup.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SYNTHETIC_TICKTICK_CSV),
    });

    await expect(page.getByText("Confirm TickTick Import")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Total tasks found")).toBeVisible();
    await expect(page.getByText("Top-level tasks")).toBeVisible();
    await expect(page.getByText("Steps")).toBeVisible();
    await expect(page.getByText("Completed tasks")).toBeVisible();
    await expect(page.getByText("Detected projects")).toBeVisible();

    const includeCompletedToggle = page.getByLabel(/include completed tasks/i);
    await expect(includeCompletedToggle).toBeVisible();
    await expect(includeCompletedToggle).toBeChecked();

    const importButton = page.getByRole("button", {
      name: /import \d+ tasks/i,
    });
    await expect(importButton).toBeVisible();
    await importButton.click();

    await expect(page.getByText(/imported \d+ tasks/i)).toBeVisible({
      timeout: 15_000,
    });

    await expect(page).toHaveURL(/\/\?project=all/, { timeout: 15_000 });
    await expect(
      page.getByText("Synthetic TickTick Root Task").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("cancels preview without importing tasks or leaking state", async ({
    page,
  }) => {
    await openAppMigrationDialog(page);

    const fileInput = page.getByLabel("Upload TickTick backup CSV file");
    await fileInput.setInputFiles({
      name: "TickTickBackup.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SYNTHETIC_TICKTICK_CSV),
    });

    await expect(page.getByText("Confirm TickTick Import")).toBeVisible({
      timeout: 10_000,
    });

    const cancelButton = page.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    await expect(page.getByText("Confirm TickTick Import")).not.toBeVisible();

    const storedRaw = await page.evaluate(() =>
      localStorage.getItem("kanso_guest_data_v11"),
    );
    const storedData = storedRaw ? JSON.parse(storedRaw) : {};
    const tasks = storedData.tasks ?? [];
    const found = tasks.some(
      (t: { content?: string }) => t.content === "Synthetic TickTick Root Task",
    );
    expect(found).toBe(false);
  });
});
