import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { FocusSettingsDialog } from "@/components/FocusSettingsDialog";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: false,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn((query: string) => !query.includes("max-width")),
}));

const mockUpdateSettings = vi.fn();

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    state: {
      mode: "focus" as const,
      isRunning: false,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
    },
    settings: { ...DEFAULT_TIMER_SETTINGS },
    updateSettings: mockUpdateSettings,
  }),
}));

describe("FocusSettingsDialog Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides accessible labels and associated controls for all durations, sliders, and switches", async () => {
    render(<FocusSettingsDialog />);

    // Open settings dialog
    const adjustButton = screen.getByRole("button", {
      name: /adjust settings/i,
    });
    fireEvent.click(adjustButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Inputs have accessible names and tabular-nums styling
    const focusDurationInput = screen.getByRole("spinbutton", {
      name: "Focus Duration",
    });
    expect(focusDurationInput).toBeInTheDocument();
    expect(focusDurationInput).toHaveClass("tabular-nums", "h-8", "w-14");
    expect(screen.getByLabelText("Focus Duration")).toBe(focusDurationInput);

    const shortBreakInput = screen.getByRole("spinbutton", {
      name: "Short Break",
    });
    expect(shortBreakInput).toBeInTheDocument();
    expect(shortBreakInput).toHaveClass("tabular-nums", "h-8", "w-14");
    expect(screen.getByLabelText("Short Break")).toBe(shortBreakInput);

    const longBreakInput = screen.getByRole("spinbutton", {
      name: "Long Break",
    });
    expect(longBreakInput).toBeInTheDocument();
    expect(longBreakInput).toHaveClass("tabular-nums", "h-8", "w-14");
    expect(screen.getByLabelText("Long Break")).toBe(longBreakInput);

    const sessionsInput = screen.getByRole("spinbutton", {
      name: "Sessions Until Long Break",
    });
    expect(sessionsInput).toBeInTheDocument();
    expect(sessionsInput).toHaveClass("tabular-nums", "h-8", "w-14");
    expect(screen.getByLabelText("Sessions Until Long Break")).toBe(
      sessionsInput,
    );

    // All 4 sliders have explicit aria-labels matching their thumbs
    expect(
      screen.getByRole("slider", { name: "Focus duration slider" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Short break duration slider" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Long break duration slider" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Sessions until long break slider" }),
    ).toBeInTheDocument();

    // Both switches have accessible names
    const autoBreakSwitch = screen.getByRole("switch", {
      name: "Auto-start Breaks",
    });
    expect(autoBreakSwitch).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-start Breaks")).toBe(autoBreakSwitch);

    const autoFocusSwitch = screen.getByRole("switch", {
      name: "Auto-start Focus",
    });
    expect(autoFocusSwitch).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-start Focus")).toBe(autoFocusSwitch);
  });
});
