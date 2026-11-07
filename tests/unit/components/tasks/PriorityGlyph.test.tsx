import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PriorityGlyph } from "@/components/tasks/PriorityGlyph";
import React from "react";

describe("PriorityGlyph", () => {
  it("renders P1 glyph with 3 active bars", () => {
    render(<PriorityGlyph level={1} />);
    const glyph = screen.getByRole("img", { name: "Priority P1" });
    expect(glyph).toBeInTheDocument();
    expect(glyph).toHaveAttribute("title", "Priority P1");
    expect(glyph.children).toHaveLength(3);
    expect(glyph.children[0].className).toContain("h-1.5");
    expect(glyph.children[0].className).toContain("opacity-100");
    expect(glyph.children[1].className).toContain("h-2.5");
    expect(glyph.children[1].className).toContain("opacity-100");
    expect(glyph.children[2].className).toContain("h-3.5");
    expect(glyph.children[2].className).toContain("opacity-100");
  });

  it("renders P2 glyph with 2 active bars and 1 muted bar", () => {
    render(<PriorityGlyph level={2} />);
    const glyph = screen.getByRole("img", { name: "Priority P2" });
    expect(glyph).toBeInTheDocument();
    expect(glyph.children[0].className).toContain("h-1.5");
    expect(glyph.children[0].className).toContain("opacity-100");
    expect(glyph.children[1].className).toContain("h-2.5");
    expect(glyph.children[1].className).toContain("opacity-100");
    expect(glyph.children[2].className).toContain("h-1");
    expect(glyph.children[2].className).toContain("opacity-20");
  });

  it("renders P3 glyph with 1 active bar and 2 muted bars", () => {
    render(<PriorityGlyph level={3} />);
    const glyph = screen.getByRole("img", { name: "Priority P3" });
    expect(glyph).toBeInTheDocument();
    expect(glyph.children[0].className).toContain("h-1.5");
    expect(glyph.children[0].className).toContain("opacity-100");
    expect(glyph.children[1].className).toContain("h-1");
    expect(glyph.children[1].className).toContain("opacity-20");
    expect(glyph.children[2].className).toContain("h-1");
    expect(glyph.children[2].className).toContain("opacity-20");
  });

  it("returns null for P4 or missing priority", () => {
    const { container: c4 } = render(<PriorityGlyph level={4} />);
    expect(c4.firstChild).toBeNull();

    const { container: cNull } = render(<PriorityGlyph level={null} />);
    expect(cNull.firstChild).toBeNull();

    const { container: cUnderflow } = render(<PriorityGlyph level={0} />);
    expect(cUnderflow.firstChild).toBeNull();
  });
});
