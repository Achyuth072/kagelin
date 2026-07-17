import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

// A real Loop Habit Tracker export. Not committed (personal data), so these
// skip unless you drop one in the repo root. Requires `npm run build && npm start`.
const DB_FILE = path.resolve(
  __dirname,
  "../../Loop Habits Backup 2026-07-16 124511.db",
);

const readGuestCounts = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("kanso_guest_data_v11");
    const d = raw ? JSON.parse(raw) : {};
    return {
      habits: d.habits?.length ?? 0,
      entries: d.habit_entries?.length ?? 0,
    };
  });

const openImport = async (page: Page) => {
  await page
    .getByRole("button", { name: "Account", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /import from other apps/i }).click();
  await page.setInputFiles('input[type="file"][accept=".db"]', DB_FILE);
};

test.describe("Loop Habit Tracker import (guest mode)", () => {
  test.setTimeout(120_000);
  test.skip(() => !fs.existsSync(DB_FILE), "no Loop backup fixture present");

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: "kanso_guest_mode",
        value: "true",
        url: "http://localhost:3000/",
      },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem("kanso_guest_mode", "true");
    });
    await page.goto("http://localhost:3000/settings", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
  });

  test("imports a real .db backup end-to-end", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    // Guest mode seeds demo data, so assert on the delta the import adds.
    const before = await readGuestCounts(page);
    console.log("BEFORE:", JSON.stringify(before));

    await openImport(page);

    const success = page.getByText(/Imported \d+ habits with \d+ history/i);
    await expect(success).toBeVisible({ timeout: 60_000 });
    console.log("TOAST:", await success.textContent());

    // Round-trip: reload and confirm the data actually persisted.
    await page.goto("http://localhost:3000/habits", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/EARLY TO RISE/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const stored = await readGuestCounts(page);
    console.log("PERSISTED:", JSON.stringify(stored));

    await page.screenshot({
      path: "test-results/uhabits-import-result.png",
      fullPage: true,
    });

    // 5 non-archived habits; 1944 = value=2 rows for those habits, deduped.
    expect(stored.habits - before.habits).toBe(5);
    expect(stored.entries - before.entries).toBe(1944);
    expect(consoleErrors.join("\n")).not.toMatch(/wasm|magic|CompileError/i);
  });

  test("re-importing the same file skips duplicates", async ({ page }) => {
    await openImport(page);
    await expect(
      page.getByText(/Imported \d+ habits with \d+ history/i),
    ).toBeVisible({ timeout: 60_000 });

    await openImport(page);
    const dup = page.getByText(/already exist/i);
    await expect(dup).toBeVisible({ timeout: 60_000 });
    console.log("RE-IMPORT TOAST:", await dup.textContent());
  });
});
