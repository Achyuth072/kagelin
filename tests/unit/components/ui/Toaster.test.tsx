import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useUiStore } from "@/lib/store/uiStore";

const { mockSonnerToaster } = vi.hoisted(() => {
  const mockSonnerToaster = vi.fn((_props: import("sonner").ToasterProps) => (
    <div data-testid="sonner-toaster-mock" />
  ));
  return { mockSonnerToaster };
});

vi.mock("next/font/google", () => ({
  Inter: vi.fn(() => ({
    variable: "--font-inter",
    style: { fontFamily: "Inter" },
  })),
}));

vi.mock("sonner", () => ({
  Toaster: mockSonnerToaster,
}));

import { Toaster } from "@/components/ui/toaster";

describe("Toaster component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mobile toasts with collapsed stack, visibleToasts=2, and FAB-lifted bottom offset", () => {
    useUiStore.setState({ isDesktop: false, isChangelogOpen: false });

    render(<Toaster />);

    expect(mockSonnerToaster).toHaveBeenCalled();
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeDefined();

    expect(lastCall?.position).toBe("bottom-center");
    expect(lastCall?.expand).toBe(false);
    expect(lastCall?.visibleToasts).toBe(2);
    expect(lastCall?.closeButton).toBe(false);
    expect(lastCall?.swipeDirections).toEqual(["left", "right", "bottom"]);

    const expectedMobileBottom =
      "calc(var(--mobile-nav-height) + 0.75rem + max(3.75rem, var(--telemetry-prompt-offset, 0px), var(--floating-timer-offset, 0px)))";

    expect(lastCall?.offset).toEqual({
      left: 16,
      right: 16,
      bottom: expectedMobileBottom,
    });
    expect(lastCall?.mobileOffset).toEqual({
      left: 16,
      right: 16,
      bottom: expectedMobileBottom,
    });
  });

  it("renders desktop toasts with collapsed stack, visibleToasts=3, and bottom-right position", () => {
    useUiStore.setState({ isDesktop: true, isChangelogOpen: false });

    render(<Toaster />);

    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeDefined();

    expect(lastCall?.position).toBe("bottom-right");
    expect(lastCall?.expand).toBe(false);
    expect(lastCall?.visibleToasts).toBe(3);
    expect(lastCall?.closeButton).toBe(true);
    expect(lastCall?.swipeDirections).toEqual(["left", "right", "bottom"]);

    const expectedDesktopBottom =
      "calc(1.5rem + max(var(--floating-timer-offset, 0px), calc(var(--offline-pill-offset, 0px) + var(--telemetry-prompt-offset, 0px))))";

    expect(lastCall?.offset).toEqual({
      bottom: expectedDesktopBottom,
    });
    expect(lastCall?.mobileOffset).toEqual({
      bottom: expectedDesktopBottom,
    });
  });

  it("configures select-none, cursor-default, and accessible close button styling", () => {
    useUiStore.setState({ isDesktop: true, isChangelogOpen: false });

    render(<Toaster />);

    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeDefined();

    const classNames = lastCall?.toastOptions?.classNames;
    expect(classNames?.toast).toContain("select-none");
    expect(classNames?.toast).toContain("cursor-default");
    expect(classNames?.error).toContain("select-text");
    expect(classNames?.closeButton).toContain("text-muted-foreground");
    expect(classNames?.closeButton).toContain("hover:text-foreground");
    expect(classNames?.closeButton).toContain("hover:bg-muted/60");
    expect(classNames?.closeButton).toContain("rounded-md");
    expect(classNames?.closeButton).not.toContain("hover:bg-sidebar");
    expect(classNames?.closeButton).not.toContain("-mr-");
    expect(classNames?.closeButton).toContain("transition-seijaku-fast");

    const closeIcon = lastCall?.icons?.close as React.ReactElement<{
      className?: string;
      strokeWidth?: number;
    }>;
    expect(closeIcon).toBeDefined();
    expect(closeIcon.props.strokeWidth).toBe(2.25);
    expect(closeIcon.props.className).toContain("h-3.5 w-3.5");
  });
});
