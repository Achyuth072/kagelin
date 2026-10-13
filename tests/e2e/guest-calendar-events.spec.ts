import { test, expect, type Page } from "@playwright/test";
import { seedGuestMode, waitForBackAnchor } from "./support/guest-mode";

const TITLE = "Guest e2e event";

function storedTitles(page: Page) {
  return page.evaluate(() => {
    const data = JSON.parse(
      localStorage.getItem("kanso_guest_data_v11") ?? "{}",
    );
    return (data.events ?? []).map((e: { title: string }) => e.title);
  });
}

test.describe("Guest calendar events", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebKit needs Docker on this machine",
  );

  test("a created event survives a reload", async ({ page }) => {
    await seedGuestMode(page, "http://localhost:3000/calendar");

    await page.getByRole("button", { name: "New Event" }).click();
    await page.getByPlaceholder("Add title").fill(TITLE);
    await page.getByRole("button", { name: "Create event" }).click();

    await expect.poll(() => storedTitles(page)).toContain(TITLE);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBackAnchor(page, "/calendar");

    await expect(page.getByText(TITLE).first()).toBeVisible();
  });
});
