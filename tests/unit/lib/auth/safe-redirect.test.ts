import { describe, it, expect } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";

describe("sanitizeNextPath (H-3)", () => {
  it("allows a plain relative path", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/settings?tab=account")).toBe(
      "/settings?tab=account",
    );
  });

  it("falls back to / when next is null or missing", () => {
    expect(sanitizeNextPath(null)).toBe("/");
  });

  it("falls back to / for an empty string", () => {
    expect(sanitizeNextPath("")).toBe("/");
  });

  it("rejects protocol-relative //host redirects", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/");
    expect(sanitizeNextPath("//evil.com/phish")).toBe("/");
  });

  it("rejects backslash variants some browsers normalize to //host", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/");
    expect(sanitizeNextPath("\\\\evil.com")).toBe("/");
    expect(sanitizeNextPath("\\/evil.com")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/");
    expect(sanitizeNextPath("http://evil.com")).toBe("/");
  });
});
