import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  createConfirmedTestAccount,
  deleteTestAccount,
  signInWithPasswordUI,
  type TestAccount,
} from "./support/testAccount";

const OLD_PASSPHRASE = "a very strong test passphrase 42";
const NEW_PASSPHRASE = "another very strong passphrase 43";

// Argon2id runs several times per test (setup, unlock check, two new wrappers).
test.setTimeout(180_000);

let admin: SupabaseClient;
let account: TestAccount;

test.beforeEach(async () => {
  admin = adminClient();
  account = await createConfirmedTestAccount(admin);
});

test.afterEach(async () => {
  await deleteTestAccount(admin, account.id);
});

async function completePassphraseSetup(page: Page) {
  await expect(page.getByText("Protect your content")).toBeVisible();
  await page.getByLabel("Passphrase", { exact: true }).fill(OLD_PASSPHRASE);
  await page
    .getByLabel("Confirm passphrase", { exact: true })
    .fill(OLD_PASSPHRASE);
  await page.getByRole("button", { name: "Set passphrase" }).click();
  await expect(page.getByText("Save your recovery code")).toBeVisible();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect
    .poll(async () => (await keyRow())?.migrated_at, { timeout: 30_000 })
    .not.toBeNull();
  // The first pass ends by moving to the home page; navigating earlier gets overridden.
  await expect(page.getByText("Encrypting your content")).not.toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: /^Good / })).toBeVisible({
    timeout: 30_000,
  });
}

async function keyRow() {
  const { data } = await admin
    .from("encryption_keys")
    .select("current_key_id, retired_keys, sealed_v2_at, migrated_at")
    .eq("user_id", account.id)
    .maybeSingle();
  return data;
}

async function inboxName(): Promise<string> {
  const { data } = await admin
    .from("projects")
    .select("name")
    .eq("user_id", account.id)
    .order("created_at")
    .limit(1)
    .single();
  return data!.name;
}

async function rotate(page: Page) {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Account" }).click();
  await page.getByRole("button", { name: "Rotate content key" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("Current Passphrase").fill(OLD_PASSPHRASE);
  await dialog
    .getByLabel("New Passphrase", { exact: true })
    .fill(NEW_PASSPHRASE);
  await dialog.getByLabel("Confirm New Passphrase").fill(NEW_PASSPHRASE);
  await dialog.getByRole("button", { name: "Rotate key" }).click();
  await expect(dialog.getByText("Your key is rotated.")).toBeVisible({
    timeout: 60_000,
  });
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Done" }).click();
}

test("rotation keeps the -v2 marker, re-seals under the new key and drops the retired key", async ({
  page,
}) => {
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);
  expect(await inboxName()).toMatch(/^xchacha20poly1305-v2:1:/);

  await rotate(page);

  const afterCommit = await keyRow();
  expect(afterCommit?.current_key_id).toBe(2);
  expect(afterCommit?.sealed_v2_at).not.toBeNull();

  await expect
    .poll(async () => (await keyRow())?.retired_keys, { timeout: 30_000 })
    .toEqual({});
  expect(await inboxName()).toMatch(/^xchacha20poly1305-v2:2:/);
});

test("a direct UPDATE cannot change the wrappers, the key chain or a marker", async ({
  page,
}) => {
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);

  const user = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await user.auth.signInWithPassword(account);
  expect(signInError).toBeNull();

  for (const patch of [
    { current_key_id: 5 },
    { sealed_v2_at: null },
    { migrated_at: null },
    { retired_keys: { "9": "planted" } },
    { sealed_v2_at: new Date().toISOString() },
    { wrapped_key_passphrase: "planted" },
    { wrapped_key_recovery: "planted" },
    { rotation_verifier: "planted" },
  ]) {
    const { error } = await user
      .from("encryption_keys")
      .update(patch)
      .eq("user_id", account.id);
    expect(error?.message, JSON.stringify(patch)).toMatch(
      /Only a device holding the content key/,
    );
  }
  const { error: forgedProof } = await user.rpc("update_encryption_key_row", {
    p_expected_key_id: 1,
    p_rotation_token: btoa("forged"),
    p_patch: { wrapped_key_passphrase: "planted" },
  });
  expect(forgedProof?.message).toMatch(/could not prove/);
  expect((await keyRow())?.current_key_id).toBe(1);
});

test("a value moved from another row is reported and keeps the retired key", async ({
  page,
}) => {
  await signInWithPasswordUI(page, account);
  await completePassphraseSetup(page);

  // A ciphertext lifted from the Inbox row fails authentication in any other row.
  const { error } = await admin.from("projects").insert({
    id: crypto.randomUUID(),
    user_id: account.id,
    name: await inboxName(),
  });
  expect(error).toBeNull();

  await rotate(page);

  await expect(
    page.getByText(/1 item can't be read \(projects\.name\)/),
  ).toBeVisible({ timeout: 30_000 });
  const row = await keyRow();
  expect(row?.current_key_id).toBe(2);
  expect(Object.keys(row?.retired_keys ?? {})).toEqual(["1"]);
});
