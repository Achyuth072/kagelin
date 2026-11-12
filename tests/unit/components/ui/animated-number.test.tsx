import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
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
});
