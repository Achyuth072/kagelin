import { test, expect } from "@playwright/test";
import { seedGuestMode, waitForBackAnchor } from "./support/guest-mode";

// Focus Duration lives in /focus's dialog, not /settings — see FocusSettingsDialog.tsx.

test.describe("Focus Settings (Guest Mode)", () => {
  test.beforeEach(async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/focus");
    await expect(
      page.getByRole("button", { name: /adjust settings/i }),
    ).toBeVisible();
  });

  test("should persist focus duration changes", async ({ page }) => {
    await page.getByRole("button", { name: /adjust settings/i }).click();

    const durationInput = page.getByRole("spinbutton", {
      name: "Focus Duration",
    });
    await expect(durationInput).toBeVisible();
    await durationInput.fill("40");

    await page.getByRole("button", { name: "Save changes" }).click();

    // zustand persist flushes a tick after watch(); reload too soon rereads stale data.
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("kanso-timer-storage") ?? "{}").state
          ?.settings?.focusDuration === 40,
      undefined,
      { timeout: 5_000 },
    );

    await page.reload();
    await waitForBackAnchor(page, "/focus");
    const adjustSettingsBtn = page.getByRole("button", {
      name: /adjust settings/i,
    });
    await expect(adjustSettingsBtn).toBeVisible();
    // force: true — the guest-mode "back up now" toast can overlap this button.
    await adjustSettingsBtn.click({ force: true });

    // defaultValues race async rehydration; toHaveValue retries until correct.
    const newDurationInput = page.getByRole("spinbutton", {
      name: "Focus Duration",
    });
    await expect(newDurationInput).toHaveValue("40");
  });
});

test.describe("Settings page (Guest Mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seedGuestMode(page, "http://localhost:3000/settings?tab=account");
  });

  test("Sync to Account points at signup, not the sign-in form", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sync to Account" }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("only the content pane scrolls, not the whole page", async ({
    page,
  }) => {
    // Nested <main>: AppShell's outer shell + SettingsClient's own scroll pane.
    const pane = page.locator("main main");
    await pane.evaluate((el) => el.scrollTo(0, el.scrollHeight));

    await expect
      .poll(() => pane.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
