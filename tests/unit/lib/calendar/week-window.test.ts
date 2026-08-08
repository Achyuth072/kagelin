import { describe, it, expect } from "vitest";
import {
  computeWindowGeometry,
  clampWindowStart,
  edgeAt,
  decideSwipeGesture,
  alignTarget,
  ALIGN_TOLERANCE_PX,
} from "@/lib/calendar/week-window";

describe("computeWindowGeometry", () => {
  it("fits 3 columns at 360px (mobile floor)", () => {
    expect(computeWindowGeometry(360).visibleDays).toBe(3);
    expect(computeWindowGeometry(360).colWidth).toBeCloseTo(104);
  });

  it("fits 6 columns at 767px (mobile ceiling)", () => {
    expect(computeWindowGeometry(767).visibleDays).toBe(6);
  });

  it("clamps to a minimum of 3 even on very narrow widths", () => {
    expect(computeWindowGeometry(200).visibleDays).toBe(3);
  });

  it("clamps to a maximum of 6 even on very wide widths — the window must stay narrower than the full week", () => {
    expect(computeWindowGeometry(2000).visibleDays).toBe(6);
  });

  it("grows visible days as width grows", () => {
    expect(computeWindowGeometry(480).visibleDays).toBe(4);
    expect(computeWindowGeometry(600).visibleDays).toBe(5);
  });

  it("accepts a measured gutter width instead of the fallback", () => {
    // A wider gutter leaves less room per column.
    const withDefault = computeWindowGeometry(360);
    const withWiderGutter = computeWindowGeometry(360, 64);
    expect(withWiderGutter.colWidth).toBeLessThan(withDefault.colWidth);
  });
});

describe("clampWindowStart", () => {
  it("clamps a start index into [0, 7 - visibleDays]", () => {
    expect(clampWindowStart(0, 3)).toBe(0);
    expect(clampWindowStart(10, 3)).toBe(4);
    expect(clampWindowStart(-1, 3)).toBe(0);
  });

  it("only allows index 0 when visibleDays is 7", () => {
    expect(clampWindowStart(2, 7)).toBe(0);
  });
});

describe("edgeAt", () => {
  const tolerance = 4;

  it("reports start when scrollLeft is within tolerance of 0", () => {
    expect(edgeAt(0, 300, tolerance)).toBe("start");
    expect(edgeAt(4, 300, tolerance)).toBe("start");
  });

  it("reports end when scrollLeft is within tolerance of max", () => {
    expect(edgeAt(300, 300, tolerance)).toBe("end");
    expect(edgeAt(296, 300, tolerance)).toBe("end");
  });

  it("reports null in the middle of the track", () => {
    expect(edgeAt(150, 300, tolerance)).toBeNull();
  });
});

describe("alignTarget", () => {
  it("rounds down when resting closer to the boundary behind it", () => {
    expect(alignTarget(210, 104)).toBe(208); // 210/104 = 2.019
  });

  it("rounds up when resting closer to the boundary ahead of it", () => {
    expect(alignTarget(300, 104)).toBe(312); // 300/104 = 2.885
  });

  it("returns null once already within tolerance of a boundary", () => {
    expect(alignTarget(312, 104)).toBeNull();
    expect(alignTarget(312 + ALIGN_TOLERANCE_PX, 104)).toBeNull();
  });

  it("returns null instead of dividing by zero before the first measurement", () => {
    expect(alignTarget(150, 0)).toBeNull();
  });
});

describe("decideSwipeGesture", () => {
  const threshold = 50;

  it("pages next on a leftward swipe parked at the end edge", () => {
    expect(
      decideSwipeGesture({
        dx: 60,
        dy: 0,
        threshold,
        wasAtStart: false,
        wasAtEnd: true,
      }),
    ).toBe("next");
  });

  it("pages prev on a rightward swipe parked at the start edge", () => {
    expect(
      decideSwipeGesture({
        dx: -60,
        dy: 0,
        threshold,
        wasAtStart: true,
        wasAtEnd: false,
      }),
    ).toBe("prev");
  });

  it("does nothing on a leftward swipe not parked at the end edge (mid-week scroll instead)", () => {
    expect(
      decideSwipeGesture({
        dx: 60,
        dy: 0,
        threshold,
        wasAtStart: false,
        wasAtEnd: false,
      }),
    ).toBeNull();
  });

  it("does nothing below the swipe threshold", () => {
    expect(
      decideSwipeGesture({
        dx: 30,
        dy: 0,
        threshold,
        wasAtStart: false,
        wasAtEnd: true,
      }),
    ).toBeNull();
  });

  it("does nothing when the gesture is more vertical than horizontal", () => {
    expect(
      decideSwipeGesture({
        dx: 60,
        dy: 80,
        threshold,
        wasAtStart: false,
        wasAtEnd: true,
      }),
    ).toBeNull();
  });
});
