import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AppMigrationDialog } from "@/components/settings/AppMigrationDialog";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: vi.fn(),
}));

let mockIcsImporting = false;

vi.mock("@/lib/hooks/useIcsImport", () => ({
  useIcsImport: () => ({
    parseFile: vi.fn(),
    confirmImport: vi.fn(),
    cancelImport: vi.fn(),
    parsedEvents: [],
    fileName: null,
    isParsing: false,
    isImporting: mockIcsImporting,
  }),
}));

vi.mock("@/lib/hooks/useTodoistImport", () => ({
  useTodoistImport: () => ({
    preview: null,
    fileName: null,
    isImporting: false,
    parseFile: vi.fn(),
    confirmImport: vi.fn(),
    cancelImport: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useUhabitsImport", () => ({
  useUhabitsImport: () => ({
    parseDatabase: vi.fn(),
    isImporting: false,
  }),
}));

describe("AppMigrationDialog File Import Keyboard Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIcsImporting = false;
  });

  it("renders import cards with role=button, tabIndex=0, aria-labels and triggers on Enter and Space", () => {
    render(<AppMigrationDialog open={true} onOpenChange={vi.fn()} />);

    const icsCard = screen.getByRole("button", {
      name: /import ics calendar file/i,
    });
    const loopCard = screen.getByRole("button", {
      name: /import loop habit tracker/i,
    });
    const todoistCard = screen.getByRole("button", {
      name: /import todoist tasks/i,
    });

    expect(icsCard).toHaveAttribute("tabindex", "0");
    expect(loopCard).toHaveAttribute("tabindex", "0");
    expect(todoistCard).toHaveAttribute("tabindex", "0");

    // Check keyboard trigger for ICS card
    const icsInput = screen.getByLabelText(/upload icalendar ics file/i);
    const icsSpy = vi.spyOn(icsInput, "click");

    fireEvent.keyDown(icsCard, { key: "Enter" });
    expect(icsSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(icsCard, { key: " " });
    expect(icsSpy).toHaveBeenCalledTimes(2);

    icsSpy.mockRestore();

    // Check keyboard trigger for Loop card
    const loopInput = screen.getByLabelText(
      /upload loop habit tracker database/i,
    );
    const loopSpy = vi.spyOn(loopInput, "click");

    fireEvent.keyDown(loopCard, { key: "Enter" });
    expect(loopSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(loopCard, { key: " " });
    expect(loopSpy).toHaveBeenCalledTimes(2);

    loopSpy.mockRestore();

    // Check keyboard trigger for Todoist card
    const todoistInput = screen.getByLabelText(/upload todoist csv or zip/i);
    const todoistSpy = vi.spyOn(todoistInput, "click");

    fireEvent.keyDown(todoistCard, { key: "Enter" });
    expect(todoistSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(todoistCard, { key: " " });
    expect(todoistSpy).toHaveBeenCalledTimes(2);

    todoistSpy.mockRestore();
  });

  it("disables import cards and ignores clicks/keys when import is in progress", () => {
    mockIcsImporting = true;
    render(<AppMigrationDialog open={true} onOpenChange={vi.fn()} />);

    const icsCard = screen.getByRole("button", {
      name: /import ics calendar file/i,
    });
    expect(icsCard).toHaveAttribute("aria-disabled", "true");
    expect(icsCard).toHaveAttribute("tabindex", "-1");

    const icsInput = screen.getByLabelText(/upload icalendar ics file/i);
    const clickSpy = vi.spyOn(icsInput, "click");

    fireEvent.click(icsCard);
    fireEvent.keyDown(icsCard, { key: "Enter" });
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
