import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useUiStore } from "@/lib/store/uiStore";

const { mockSonnerToaster } = vi.hoisted(() => {
  const mockSonnerToaster = vi.fn((_props: Record<string, unknown>) => (
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
});
