import { describe, it, expect, afterEach, vi } from "vitest";
import { isTransientNetworkError } from "@/lib/utils/network-error";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isTransientNetworkError", () => {
  it.each(["Failed to fetch", "Load failed", "NetworkError"])(
    "accepts a fetch TypeError saying %j",
    (message) => {
      expect(isTransientNetworkError(new TypeError(message))).toBe(true);
    },
  );

  it("rejects a TypeError from a genuine bug", () => {
    const bug = new TypeError("Cannot read properties of undefined");

    expect(isTransientNetworkError(bug)).toBe(false);
  });

  it("rejects a server-side failure that merely mentions fetching", () => {
    expect(isTransientNetworkError(new Error("Failed to fetch events"))).toBe(
      false,
    );
  });

  it("accepts anything while the device reports itself offline", () => {
    vi.stubGlobal("navigator", { onLine: false });

    expect(isTransientNetworkError(new Error("whatever"))).toBe(true);
  });
});
