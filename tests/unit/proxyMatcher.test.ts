import { describe, it, expect } from "vitest";
import { config } from "../../proxy";

// The matcher decides which paths run through Supabase session middleware.
// Static assets fetched by the service worker's precache must bypass it —
// a redirect to /login makes the response unusable and fails SW install.
const matches = (pathname: string) =>
  config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));

describe("proxy matcher", () => {
  it("does not gate the sql.js wasm binary behind auth", () => {
    expect(matches("/sql-wasm.wasm")).toBe(false);
  });

  it("does not gate any wasm binary behind auth", () => {
    expect(matches("/some/nested/module.wasm")).toBe(false);
  });

  it("still gates app routes", () => {
    expect(matches("/settings")).toBe(true);
    expect(matches("/habits")).toBe(true);
  });

  it("still bypasses the assets it already excluded", () => {
    expect(matches("/icons/icon-192.png")).toBe(false);
    expect(matches("/manifest.json")).toBe(false);
  });
});
