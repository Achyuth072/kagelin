import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

test.describe("Discoverable search and shortcuts", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Desktop sidebar only; WebKit needs Docker on this machine",
  );

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
