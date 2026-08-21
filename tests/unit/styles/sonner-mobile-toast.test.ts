import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sonner mobile toast override", () => {
  it("keeps mobile width overrides off the toast transform property", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toMatch(
      /\[data-sonner-toaster\]\[data-x-position="center"\]\s+\[data-sonner-toast\]/,
    );
    // Composed with var(--y), not a bare translateX: overriding transform
    // outright wipes out Sonner's own per-toast vertical stacking offset,
    // collapsing every stacked toast onto the same spot. (The toaster
    // container itself, further below, still gets a bare translateX(-50%) —
    // that one doesn't touch per-toast stacking.)
    expect(css).toContain("transform: translateX(-50%) var(--y) !important;");
    expect(css).not.toContain("translate: -50% 0 !important;");
    expect(css).not.toContain('[data-sonner-toast][data-mounted="true"]');
  });
});
