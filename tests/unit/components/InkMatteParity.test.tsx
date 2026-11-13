import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { FloatingTimer } from "@/components/FloatingTimer";
import { AuthShell } from "@/components/auth/AuthShell";
import { Skeleton } from "@/components/ui/skeleton";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (
    selector: (state: {
      state: {
        mode: string;
        isRunning: boolean;
        remainingSeconds: number;
        completedSessions: number;
      };
      settings: {
        focusDuration: number;
        shortBreakDuration: number;
        longBreakDuration: number;
        sessionsBeforeLongBreak: number;
      };
    }) => unknown,
  ) =>
    selector({
      state: {
        mode: "focus",
        isRunning: true,
        remainingSeconds: 1500,
        completedSessions: 0,
      },
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
      },
    }),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ start: vi.fn(), pause: vi.fn() }),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (
    selector: (state: {
      isPipActive: boolean;
      isDesktop: boolean;
      isFocusExpanded: boolean;
      setIsFocusExpanded: () => void;
    }) => unknown,
  ) =>
    selector({
      isPipActive: false,
      isDesktop: true,
      isFocusExpanded: false,
      setIsFocusExpanded: vi.fn(),
    }),
}));

describe("Ink & Matte visual and overlay compliance", () => {
  it("FloatingTimer complies with rounded-xl and shadow-sm constraints", () => {
    render(<FloatingTimer />);
    const timer = screen.getByTestId("floating-timer");
    expect(timer.className).toContain("rounded-xl");
    expect(timer.className).toContain("shadow-sm");
    expect(timer.className).not.toContain("rounded-2xl");
    expect(timer.className).not.toContain("shadow-2xl");

    const playButton = screen.getByLabelText(/pause timer|start timer/i);
    expect(playButton.className).toContain("shadow-xs");
    expect(playButton.className).not.toContain("shadow-md");
  });

  it("AuthShell card container uses rounded-xl instead of rounded-2xl", () => {
    const { container } = render(
      <AuthShell>
        <div>Content</div>
      </AuthShell>,
    );
    const card = container.querySelector(
      ".rounded-xl.border.border-border.bg-card",
    );
    expect(card).toBeInTheDocument();
  });

  it("Skeleton includes motion-reduce:animate-none", () => {
    render(<Skeleton data-testid="test-skeleton" />);
    const skeleton = screen.getByTestId("test-skeleton");
    expect(skeleton.className).toContain("motion-reduce:animate-none");
    expect(skeleton.className).toContain("animate-pulse");
  });
});
