import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { MobileNav } from "@/components/layout/MobileNav";

const { mockPush, mockPrefetch } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPrefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush, prefetch: mockPrefetch }),
}));

vi.mock("motion/react-m", () => ({
  button: ({
    children,
    onTapStart: _onTapStart,
    whileTap: _whileTap,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onTapStart?: unknown;
    whileTap?: unknown;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: false }),
}));

describe("MobileNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 core tabs and navigates to each route", () => {
    render(<MobileNav />);

    const expected = [
      { label: "All Tasks", path: "/" },
      { label: "Calendar", path: "/calendar" },
      { label: "Stats", path: "/stats" },
    ];

    for (const item of expected) {
      const btn = screen.getByRole("button", { name: item.label });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(mockPush).toHaveBeenCalledWith(item.path);
    }

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
