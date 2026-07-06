import { describe, it, expect } from "vitest";
import { computeTickInterval } from "@/lib/utils/chart-ticks";

describe("computeTickInterval", () => {
  it("shows every tick when data fits within the target count", () => {
    expect(computeTickInterval(7, 8)).toBe(0);
  });

  it("thins ticks proportionally once data exceeds the target count", () => {
    // 30 days at a target of 8 labels (desktop) -> show every 4th
    expect(computeTickInterval(30, 8)).toBe(3);
  });

  it("thins more aggressively for a smaller target (mobile)", () => {
    // 30 days at a target of 4 labels (mobile) -> show every 8th
    expect(computeTickInterval(30, 4)).toBe(7);
  });

  it("never goes negative for tiny datasets", () => {
    expect(computeTickInterval(1, 8)).toBe(0);
    expect(computeTickInterval(0, 8)).toBe(0);
  });
});
