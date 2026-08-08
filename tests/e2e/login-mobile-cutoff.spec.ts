import { test, expect } from "@playwright/test";

// Turnstile pushes buttons below the fold on short viewports; /login has no
// scroll container. Turnstile is stubbed since it won't render headlessly.
test.describe("Login page on a short mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 560 } });

  test.beforeEach(async ({ page }) => {
    await page.route(
      "**/challenges.cloudflare.com/turnstile/v0/api.js",
      (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: `
          window.turnstile = {
            render: (container, options) => {
              const box = document.createElement("div");
              box.style.height = "65px";
              box.style.width = "100%";
              box.setAttribute("data-testid", "fake-turnstile-widget");
              container.appendChild(box);
              options.callback("fake-token");
              return "fake-widget-id";
            },
            reset: () => {},
            remove: () => {},
          };
        `,
        }),
    );
  });

  test("Guest button is reachable by scrolling when it doesn't fit", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "mobile WebKit has no mouse.wheel");
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await page.waitForSelector("[data-testid='fake-turnstile-widget']", {
      timeout: 15000,
    });

    const guestBtn = page.getByRole("button", { name: "Guest" });
    await expect(guestBtn).toBeVisible();

    // Real wheel event, not scrollIntoViewIfNeeded() — that bypasses overflow:hidden.
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);

    await expect(guestBtn).toBeInViewport({ ratio: 1 });
  });
});
