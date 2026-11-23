import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TickTickIcon } from "@/components/settings/MigrationIcons";

describe("TickTickIcon", () => {
  it("renders SVG with accessible attributes and brand visual identity", () => {
    const { container } = render(
      <TickTickIcon className="h-9 w-9" data-testid="ticktick-icon" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("h-9", "w-9");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");

    const blueArc = container.querySelector('path[fill="#4772FA"]');
    const amberCheck = container.querySelector('path[fill="#FFB000"]');
    expect(blueArc).toBeInTheDocument();
    expect(amberCheck).toBeInTheDocument();
  });
});
