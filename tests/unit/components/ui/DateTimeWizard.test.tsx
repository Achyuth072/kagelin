import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";
import React from "react";

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// Mock scroll isolation
vi.mock("@/lib/hooks/useScrollIsolation", () => ({
  useScrollIsolation: vi.fn(),
}));

describe("DateTimeWizard", () => {
  it("renders contextual title when provided", () => {
    render(
      <DateTimeWizard
        title="Set Start Date"
        date={undefined}
        setDate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Set Start Date")).toBeDefined();
  });
});
