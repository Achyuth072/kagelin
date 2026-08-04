import { test, expect } from "@playwright/test";

// Locks in the response headers added after the 2026-07-27 ZAP baseline scan
// flagged them as missing on app.kagelin.app.
test.describe("security headers", () => {
  test("document responses deny framing and sniffing", async ({ request }) => {
    const response = await request.get("/login");

    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("does not advertise the framework", async ({ request }) => {
    const response = await request.get("/login");

    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});
