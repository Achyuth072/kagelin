import { test, expect } from "@playwright/test";
import { seedGuestMode } from "./support/guest-mode";

const STORE_KEY = "kanso_guest_data_v11";
const FIRST_STEP = "Add a task (N or +)";

test.describe("Guest demo tutorial", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Desktop layout; WebKit needs Docker on this machine",
  );

  test("a fresh guest opens Meet Kagelin from the Demo bar and completes a step like any task", async ({
    page,
  }) => {
    await seedGuestMode(page, "http://localhost:3000/");
    // Demo data loads slowly when workers share the dev server.
    const demoBar = page.getByTestId("demo-bar");
    await expect(demoBar).toBeVisible({ timeout: 25_000 });
    await demoBar.getByRole("link", { name: "Meet Kagelin" }).click();
    await expect(page).toHaveURL(/project=demo-project-meet-kagelin/);

    const step = page
      .locator('[id^="task-item-"]')
      .filter({ hasText: FIRST_STEP });
    await expect(step).toBeVisible();

    // Retry until hydration attaches; avoid un-completing once checked.
    const checkbox = step.getByRole("checkbox");
    await expect(async () => {
      if (!(await checkbox.isChecked())) await checkbox.click();
      await expect(checkbox).toBeChecked({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });

    await expect
      .poll(() =>
        page.evaluate(
          ({ key, content }) =>
            JSON.parse(localStorage.getItem(key) ?? "{}").tasks?.find(
              (t: { content: string }) => t.content === content,
            )?.is_completed,
          { key: STORE_KEY, content: FIRST_STEP },
        ),
      )
      .toBe(true);
  });
});
