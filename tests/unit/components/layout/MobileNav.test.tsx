import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { MobileNav } from "@/components/layout/MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch: _prefetch,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: false }),
}));

describe("MobileNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 core tabs as links to each route", () => {
    render(<MobileNav />);

    const expected = [
      { label: "All Tasks", path: "/" },
      { label: "Calendar", path: "/calendar" },
      { label: "Stats", path: "/stats" },
    ];

    for (const item of expected) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", item.path);
    }

    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
