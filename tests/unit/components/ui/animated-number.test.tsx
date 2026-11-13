import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AnimatedNumber } from "@/components/ui/animated-number";

function getRenderedText(container: HTMLElement): string {
  const span = container.querySelector("number-flow-react > span");
  if (span) return span.textContent ?? "";
  return container.textContent ?? "";
}

describe("AnimatedNumber", () => {
  it("renders a numeric value", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    expect(getRenderedText(container)).toBe("42");
  });

  it("parses and renders percentage suffix", () => {
    const { container } = render(<AnimatedNumber value="85%" />);
    expect(getRenderedText(container)).toBe("85%");
  });

  it("parses and renders approximation prefix and hours suffix", () => {
    const { container } = render(<AnimatedNumber value="~12.5h" />);
    expect(getRenderedText(container)).toBe("~12.5h");
  });

  it("falls back to plain text for non-numeric strings", () => {
    const { container } = render(
      <AnimatedNumber value="Not a number" className="text-muted-foreground" />,
    );
    expect(container.textContent).toBe("Not a number");
    expect(container.querySelector(".text-muted-foreground")).not.toBeNull();
  });

  it("defaults trend to 0 (shortest path / neutral)", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    const el = container.querySelector("number-flow-react") as
      (HTMLElement & { trend?: unknown }) | null;
    expect(el?.trend).toBe(0);
  });

  it("allows overriding trend explicitly", () => {
    const { container } = render(<AnimatedNumber value={42} trend={-1} />);
    const el = container.querySelector("number-flow-react") as
      (HTMLElement & { trend?: unknown }) | null;
    expect(el?.trend).toBe(-1);
  });

  it("passes opacityTiming matching transformTiming", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    const el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          opacityTiming?: unknown;
          transformTiming?: unknown;
        })
      | null;
    expect(el?.opacityTiming).toBeDefined();
    expect(el?.opacityTiming).toEqual(el?.transformTiming);
  });

  it("keeps animation enabled while setting opacityTiming duration to 0 when digit count decreases", () => {
    const { container, rerender } = render(<AnimatedNumber value="163hr" />);
    let el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          animated?: boolean;
          opacityTiming?: { duration?: number };
          transformTiming?: unknown;
        })
      | null;
    expect(el?.animated).toBe(true);
    expect(el?.opacityTiming).toEqual(el?.transformTiming);

    rerender(<AnimatedNumber value="16hr" />);
    el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          animated?: boolean;
          opacityTiming?: { duration?: number };
        })
      | null;
    expect(el?.animated).toBe(true);
    expect(el?.opacityTiming).toEqual({ duration: 0 });

    rerender(<AnimatedNumber value="1200" />);
    rerender(<AnimatedNumber value="636" />);
    el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          animated?: boolean;
          opacityTiming?: { duration?: number };
        })
      | null;
    expect(el?.animated).toBe(true);
    expect(el?.opacityTiming).toEqual({ duration: 0 });
  });

  it("keeps animation enabled with full timing when integer digit count remains the same", () => {
    const { container, rerender } = render(<AnimatedNumber value="16hr" />);
    let el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          animated?: boolean;
          opacityTiming?: unknown;
          transformTiming?: unknown;
        })
      | null;
    expect(el?.animated).toBe(true);

    rerender(<AnimatedNumber value="24hr" />);
    el = container.querySelector("number-flow-react") as
      | (HTMLElement & {
          animated?: boolean;
          opacityTiming?: unknown;
          transformTiming?: unknown;
        })
      | null;
    expect(el?.animated).toBe(true);
    expect(el?.opacityTiming).toEqual(el?.transformTiming);
  });

  it("allows overriding animated explicitly", () => {
    const { container } = render(
      <AnimatedNumber value="16hr" animated={false} />,
    );
    const el = container.querySelector("number-flow-react") as
      (HTMLElement & { animated?: boolean }) | null;
    expect(el?.animated).toBe(false);
  });

  it("allows setting willChange prop for GPU layer promotion", () => {
    const { container } = render(
      <AnimatedNumber value={42} willChange={true} />,
    );
    const el = container.querySelector("number-flow-react");
    expect(el?.hasAttribute("data-will-change")).toBe(true);
  });

  it("disables animation when document is hidden to conserve resources", () => {
    const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
    try {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      const { container } = render(<AnimatedNumber value={42} />);
      const el = container.querySelector("number-flow-react") as
        (HTMLElement & { animated?: boolean }) | null;
      expect(el?.animated).toBe(false);
    } finally {
      if (originalHidden) {
        Object.defineProperty(document, "hidden", originalHidden);
      } else {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
      }
    }
  });
});
