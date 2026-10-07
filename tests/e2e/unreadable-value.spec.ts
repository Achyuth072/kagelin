import { test, expect, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  createConfirmedTestAccount,
  deleteTestAccount,
  signInWithPasswordUI,
  type TestAccount,
} from "./support/testAccount";

const PASSPHRASE = "a very strong test passphrase 42";

// Argon2id runs during setup.
test.setTimeout(120_000);

let admin: SupabaseClient;
let account: TestAccount;

test.beforeEach(async () => {
  admin = adminClient();
  account = await createConfirmedTestAccount(admin);
});

test.afterEach(async () => {
  await deleteTestAccount(admin, account.id);
});

async function setUpEncryption(page: Page) {
  await expect(page.getByText("Protect your content")).toBeVisible();
  await page.getByLabel("Passphrase", { exact: true }).fill(PASSPHRASE);
  await page.getByLabel("Confirm passphrase", { exact: true }).fill(PASSPHRASE);
  await page.getByRole("button", { name: "Set passphrase" }).click();
  await expect(page.getByText("Save your recovery code")).toBeVisible();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /^Good / })).toBeVisible({
    timeout: 60_000,
  });
}

async function createTask(page: Page, content: string) {
  await expect(async () => {
    await page.keyboard.press("n");
    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });
  await page.getByPlaceholder("What needs to be done?").fill(content);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(
    page.getByTestId("task-list-container").getByText(content),
  ).toBeVisible();
}

// The persisted query cache would repaint the cached titles until useTasks' staleTime passes,
// so drop it to make the reload read from the server.
async function reloadFromServer(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("keyval", "readwrite");
          tx.objectStore("keyval").delete("REACT_QUERY_OFFLINE_CACHE");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
}

async function storedTasks() {
  const { data } = await admin
    .from("tasks")
    .select("id, content")
    .eq("user_id", account.id)
    .limit(10);
  return data!;
}

test("a moved task title reads as unreadable in place and can be retyped", async ({
  page,
}) => {
  await signInWithPasswordUI(page, account);
  await setUpEncryption(page);
  await createTask(page, "Keep this one");
  await createTask(page, "Move into this one");

  const rows = await storedTasks();
  expect(rows).toHaveLength(2);
  // Copy one row's sealed title into the other, as someone with database access could.
  const [source, target] = rows;
  const { error } = await admin
    .from("tasks")
    .update({ content: source.content })
    .eq("id", target.id);
  expect(error).toBeNull();

  await reloadFromServer(page);
  const list = page.getByTestId("task-list-container");
  await expect(list.getByTestId("unreadable-text")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(list.getByText(/Keep this one|Move into this one/)).toHaveCount(
    1,
  );

  await list.getByTestId("unreadable-text").click();
  const title = page.getByPlaceholder("What needs to be done?");
  await expect(title).toHaveValue("");
  await title.fill("Retyped title");
  await page.getByRole("button", { name: "Save changes" }).click();

  await reloadFromServer(page);
  await expect(list.getByText("Retyped title")).toBeVisible({
    timeout: 15_000,
  });
  await expect(list.getByTestId("unreadable-text")).toHaveCount(0);
});
