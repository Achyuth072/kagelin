import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CollapsibleReveal } from "@/components/ui/collapsible-reveal";

describe("CollapsibleReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with open classes when open is true", () => {
    const { container } = render(
      <CollapsibleReveal open={true} className="w-full">
        <p>Visible Content</p>
      </CollapsibleReveal>,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("grid");
    expect(root).toHaveClass("grid-rows-[1fr]");
    expect(root).toHaveClass("opacity-100");
    expect(root).toHaveClass("w-full");
    expect(root).toHaveClass("ease-seijaku");
    expect(root).not.toHaveClass("pointer-events-none");
    expect(root.getAttribute("aria-hidden")).toBe("false");
    expect(root.hasAttribute("inert")).toBe(false);

    expect(screen.getByText("Visible Content")).toBeInTheDocument();
  });

  it("renders with collapsed classes and inert when open is false initially", () => {
    const { container } = render(
      <CollapsibleReveal open={false}>
        <p>Hidden Content</p>
      </CollapsibleReveal>,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("grid");
    expect(root).toHaveClass("grid-rows-[0fr]");
    expect(root).toHaveClass("opacity-0");
    expect(root).toHaveClass("pointer-events-none");
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.hasAttribute("inert")).toBe(true);
    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
  });

  it("supports innerClassName for the overflow-hidden container", () => {
    const { container } = render(
      <CollapsibleReveal open={true} innerClassName="p-4 space-y-2">
        <p>Padded Content</p>
      </CollapsibleReveal>,
    );

    const inner = container.querySelector(".overflow-hidden");
    expect(inner).toBeInTheDocument();
    expect(inner).toHaveClass("overflow-hidden");
    expect(inner).toHaveClass("p-4");
    expect(inner).toHaveClass("space-y-2");
  });

  it("unmounts children after closing duration when unmountOnExit is true", () => {
    const { rerender } = render(
      <CollapsibleReveal open={true} unmountOnExit>
        <p>Dynamic Content</p>
      </CollapsibleReveal>,
    );

    expect(screen.getByText("Dynamic Content")).toBeInTheDocument();

    rerender(
      <CollapsibleReveal open={false} unmountOnExit>
        <p>Dynamic Content</p>
      </CollapsibleReveal>,
    );

    // Still in DOM during animation
    expect(screen.getByText("Dynamic Content")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Unmounted after animation ends
    expect(screen.queryByText("Dynamic Content")).not.toBeInTheDocument();
  });

  it("keeps children mounted when unmountOnExit is false", () => {
    const { rerender } = render(
      <CollapsibleReveal open={true} unmountOnExit={false}>
        <p>Persistent Content</p>
      </CollapsibleReveal>,
    );

    expect(screen.getByText("Persistent Content")).toBeInTheDocument();

    rerender(
      <CollapsibleReveal open={false} unmountOnExit={false}>
        <p>Persistent Content</p>
      </CollapsibleReveal>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("Persistent Content")).toBeInTheDocument();
  });
});
