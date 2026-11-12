import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sonner mobile toast override", () => {
  it("keeps mobile width overrides off the toast transform property", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toMatch(
      /\[data-sonner-toaster\]\[data-x-position="center"\]\s+\[data-sonner-toast\]/,
    );
    // Center via left:0/right:0 and margin-inline:auto so Sonner's transform is
    // left untouched. Overriding transform with !important suppresses Sonner's
    // touch-tracking swipe offsets and swipe-out @keyframes exit animations.
    expect(css).toContain("margin-inline: auto !important;");
    expect(css).toContain("left: 0 !important;");
    expect(css).toContain("right: 0 !important;");
    expect(css).not.toContain("translateX(-50%) var(--y)");
    expect(css).not.toContain("translate: -50% 0 !important;");
    expect(css).not.toContain('[data-sonner-toast][data-mounted="true"]');
  });
});
