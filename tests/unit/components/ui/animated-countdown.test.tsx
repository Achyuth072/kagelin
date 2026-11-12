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
});
