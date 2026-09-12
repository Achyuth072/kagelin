import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  createConfirmedTestAccount,
  deleteTestAccount,
  minimalGuestData,
  seedGuestData,
  signInWithPasswordUI,
  type TestAccount,
} from "./support/testAccount";

// Automated verification for manual test plan §7 and §12 (.scratch/encryption/manual-test-plan-v1.43.0-preview.2.md).

let admin: SupabaseClient;
let account: TestAccount;

test.beforeEach(async () => {
  admin = adminClient();
  account = await createConfirmedTestAccount(admin);
});

test.afterEach(async () => {
  await deleteTestAccount(admin, account.id);
});

async function completePassphraseSetup(page: import("@playwright/test").Page) {
  await expect(page.getByText("Protect your content")).toBeVisible();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("a very strong test passphrase 42");
  await page
    .getByLabel("Confirm passphrase", { exact: true })
    .fill("a very strong test passphrase 42");
  await page.getByRole("button", { name: "Set passphrase" }).click();

  await expect(page.getByText("Save your recovery code")).toBeVisible();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // handle_new_user() creates an Inbox project, triggering backfill encryption on new accounts.
  const backfillHeading = page.getByText("Encrypting your content");
  const appeared = await backfillHeading
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await expect(backfillHeading).not.toBeVisible({ timeout: 20_000 });
  }
}

// Poll DB directly: successful migration reloads the page before UI toasts settle.
async function waitForTaskCount(
  admin: SupabaseClient,
  userId: string,
  expected: number,
) {
  await expect
    .poll(
      async () => {
        const { count } = await admin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        return count;
      },
      { timeout: 20_000 },
    )
    .toBe(expected);
}

test("guest → registered conversion uploads ciphertext, not plaintext (§7)", async ({
  page,
  context,
}) => {
  const guestData = minimalGuestData();
  await seedGuestData(context, page, guestData);
  await signInWithPasswordUI(page, account);

  await completePassphraseSetup(page);
  await waitForTaskCount(admin, account.id, guestData.tasks.length);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("content, description")
    .eq("user_id", account.id)
    .limit(100);
  expect(error).toBeNull();
  expect(tasks).toHaveLength(guestData.tasks.length);
  for (const task of tasks!) {
    expect(task.content).not.toContain("Migration test");
    expect(task.content).toMatch(/^[A-Za-z0-9+/=:.-]+$/);
  }
});

test("migration recovers from a transient failure and doesn't duplicate rows (§12)", async ({
  page,
  context,
}) => {
  const guestData = minimalGuestData();
  await seedGuestData(context, page, guestData);
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);

  // Fail task insert to test recovery after partial writes.
  let failedOnce = false;
  await page.route("**/rest/v1/tasks*", async (route) => {
    if (route.request().method() === "POST" && !failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, body: "simulated failure" });
      return;
    }
    await route.continue();
  });

  await expect(page.getByText("Sync interrupted")).toBeVisible({
    timeout: 15_000,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTaskCount(admin, account.id, guestData.tasks.length);

  const [{ data: projects }, { data: tasks }, { data: habits }] =
    await Promise.all([
      admin.from("projects").select("id").eq("user_id", account.id).limit(100),
      admin
        .from("tasks")
        .select("id, parent_id")
        .eq("user_id", account.id)
        .limit(100),
      admin.from("habits").select("id").eq("user_id", account.id).limit(100),
    ]);

  // +1 for the account's auto-created Inbox project (handle_new_user()).
  expect(projects).toHaveLength(guestData.projects.length + 1);
  expect(tasks).toHaveLength(guestData.tasks.length);
  expect(habits).toHaveLength(guestData.habits.length);

  const child = tasks!.find((t) => t.parent_id !== null);
  expect(child?.parent_id).toBe(tasks!.find((t) => t.parent_id === null)!.id);
});

test("stuck migration shows the export banner after 2 failures, then succeeds (§12)", async ({
  page,
  context,
}) => {
  const guestData = minimalGuestData();
  await seedGuestData(context, page, guestData);
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);

  let failures = 0;
  await page.route("**/rest/v1/tasks*", async (route) => {
    if (route.request().method() === "POST" && failures < 2) {
      failures += 1;
      await route.fulfill({ status: 500, body: "simulated failure" });
      return;
    }
    await route.continue();
  });

  await expect(page.getByText("Sync interrupted")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("We're having trouble syncing your data.", { exact: true }),
  ).not.toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("We're having trouble syncing your data.", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^kanso-guest-backup-.*\.zip$/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTaskCount(admin, account.id, guestData.tasks.length);
  await expect(
    page.getByText("We're having trouble syncing your data.", { exact: true }),
  ).not.toBeVisible();
});

test("migration resumes after an actual tab close, not just a reload (§12)", async ({
  page,
  context,
}) => {
  const guestData = minimalGuestData();
  await seedGuestData(context, page, guestData);
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);

  // Interrupt initial migration to test closing the tab mid-sync.
  let failedOnce = false;
  await context.route("**/rest/v1/tasks*", async (route) => {
    if (route.request().method() === "POST" && !failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, body: "simulated failure" });
      return;
    }
    await route.continue();
  });

  await expect(page.getByText("Sync interrupted")).toBeVisible({
    timeout: 15_000,
  });

  await page.close();
  const newPage = await context.newPage();
  await newPage.goto("/", { waitUntil: "domcontentloaded" });

  await waitForTaskCount(admin, account.id, guestData.tasks.length);
});

test("re-running migration on an already-migrated account is a no-op (§12)", async ({
  page,
  context,
}) => {
  const guestData = minimalGuestData();
  await seedGuestData(context, page, guestData);
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);
  await waitForTaskCount(admin, account.id, guestData.tasks.length);

  const { data: firstRunTasks } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", account.id)
    .limit(100);

  await seedGuestData(context, page, guestData);
  await page.reload({ waitUntil: "domcontentloaded" });

  const { data: secondRunTasks } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", account.id)
    .limit(100);

  expect(secondRunTasks?.map((t) => t.id).sort()).toEqual(
    firstRunTasks?.map((t) => t.id).sort(),
  );
});
