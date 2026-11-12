import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { HabitQuantityPopover } from "@/components/habits/HabitQuantityPopover";

let mockIsMobile = false;
const mockUseBackNavigation = vi.fn();

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query === "(max-width: 640px)") return mockIsMobile;
    return !mockIsMobile;
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: mockIsMobile }),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: (open: boolean, onClose: () => void) =>
    mockUseBackNavigation(open, onClose),
}));

describe("HabitQuantityPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile = false;
  });

  it("uses ResponsiveDialog (Drawer + back navigation) on mobile without nesting buttons", () => {
    mockIsMobile = true;
    const { container } = render(
      <HabitQuantityPopover
        stored={null}
        unit="pages"
        targetValue={10}
        onLog={vi.fn()}
        onClear={vi.fn()}
      >
        <button type="button">Log pages</button>
      </HabitQuantityPopover>,
    );

    expect(container.querySelectorAll("button button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Log pages" }));

    expect(document.querySelector("[data-vaul-drawer]")).toBeInTheDocument();
    expect(mockUseBackNavigation).toHaveBeenCalledWith(
      true,
      expect.any(Function),
    );
  });

  it("keeps an anchored Popover on desktop viewports", () => {
    mockIsMobile = false;
    render(
      <HabitQuantityPopover
        stored={5}
        unit="pages"
        targetValue={10}
        onLog={vi.fn()}
        onClear={vi.fn()}
      >
        <button type="button">Log pages</button>
      </HabitQuantityPopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log pages" }));

    expect(
      document.querySelector("[data-radix-popper-content-wrapper]"),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-vaul-drawer]")).toBeNull();
  });
});
