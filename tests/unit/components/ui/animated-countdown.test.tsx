import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import { AnimatedCountdown } from "@/components/ui/animated-countdown";

function getRenderedTime(container: HTMLElement): string {
  const spans = Array.from(
    container.querySelectorAll("number-flow-react > span"),
  );
  return `${spans[0]?.textContent ?? ""}:${spans[1]?.textContent ?? ""}`;
}

describe("AnimatedCountdown", () => {
  it("renders 25:00 for 1500 seconds", () => {
    const { container } = render(<AnimatedCountdown seconds={1500} />);
    expect(getRenderedTime(container)).toBe("25:00");
  });

  it("renders 00:59 for 59 seconds", () => {
    const { container } = render(<AnimatedCountdown seconds={59} />);
    expect(getRenderedTime(container)).toBe("00:59");
  });

  it("renders 00:00 for 0 seconds", () => {
    const { container } = render(<AnimatedCountdown seconds={0} />);
    expect(getRenderedTime(container)).toBe("00:00");
  });

  it("clamps negative seconds to 00:00", () => {
    const { container } = render(<AnimatedCountdown seconds={-10} />);
    expect(getRenderedTime(container)).toBe("00:00");
  });

  it("preserves tabular-nums class for alignment", () => {
    const { container } = render(
      <AnimatedCountdown seconds={120} className="font-mono" />,
    );
    const div = container.querySelector(".tabular-nums");
    expect(div).not.toBeNull();
    expect(div?.className).toContain("font-mono");
  });

  it("constrains the tens digit (position 1) to max 5 so the ones digit (position 0) is not clipped", () => {
    const { container } = render(<AnimatedCountdown seconds={59} />);
    const flows = container.querySelectorAll("number-flow-react");
    const secondsFlow = flows[1] as HTMLElement & {
      digits?: Record<number, { max?: number }>;
    };
    expect(secondsFlow.digits).toEqual({ 1: { max: 5 } });
  });

  it("renders 120:00 for 7200 seconds (120 minutes maximum)", () => {
    const { container } = render(<AnimatedCountdown seconds={7200} />);
    expect(getRenderedTime(container)).toBe("120:00");
  });

  it("renders 119:59 for 7199 seconds", () => {
    const { container } = render(<AnimatedCountdown seconds={7199} />);
    expect(getRenderedTime(container)).toBe("119:59");
  });

  it("leaves minutes unconstrained so 3 digits and tens digits >= 6 render without clipping", () => {
    const { container } = render(<AnimatedCountdown seconds={7200} />);
    const flows = container.querySelectorAll("number-flow-react");
    const minutesFlow = flows[0] as HTMLElement & {
      digits?: Record<number, { max?: number }>;
    };
    expect(minutesFlow.digits).toBeUndefined();
  });
});
