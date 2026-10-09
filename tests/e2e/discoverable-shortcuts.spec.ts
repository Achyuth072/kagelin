import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

test.describe("Discoverable search and shortcuts", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Desktop sidebar only; WebKit needs Docker on this machine",
  );

  test("the sidebar opens search and the shortcuts list without a key", async ({
    page,
  }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    const sidebar = page.locator("[data-sidebar=sidebar]");

    // The click handler attaches after hydration, which can land after
    // domcontentloaded — retry instead of racing a fixed sleep.
    await expect(async () => {
      await sidebar.getByRole("button", { name: /Search/ }).click();
      await expect(
        page.getByRole("dialog", { name: "Command Menu" }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    await sidebar.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Keyboard Shortcuts" }),
    ).toBeVisible();
  });

  test("sidebar rows name their key", async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    const sidebar = page.locator("[data-sidebar=sidebar]");

    const habits = sidebar.getByRole("link", { name: "Habits" });
    await expect(habits).toHaveAttribute("aria-keyshortcuts", "2");
    await expect(habits.locator("kbd")).toHaveText("2");
  });

  test("pressing ? opens the shortcuts list", async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });

    await expect(async () => {
      await page.keyboard.press("Shift+Slash");
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });
  });
});
