import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MonthView } from "@/components/calendar/MonthView";
import { DayColumn } from "@/components/calendar/DayColumn";
import { EventOverflowPopover } from "@/components/calendar/EventOverflowPopover";
import type { CalendarEvent } from "@/lib/calendar/types";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/lib/hooks/useSwipe", () => ({
  useSwipe: vi.fn(() => ({})),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    next: vi.fn(),
    prev: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useTimeFormat", () => ({
  useTimeFormat: () => ({
    formatTime: (_d: Date) => "10:00 AM",
  }),
}));

const mockEvent: CalendarEvent = {
  id: "evt-1",
  title: "Sprint Planning",
  start: new Date(2026, 10, 4, 10, 0),
  end: new Date(2026, 10, 4, 11, 0),
  allDay: false,
  color: "#4B6CB7",
  category: "event",
};

describe("Calendar Views Keyboard Navigation & Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MonthView Grid & Events", () => {
    it("renders WAI-ARIA APG grid roles and makes cells & events keyboard focusable and actionable", () => {
      const onDateClick = vi.fn();
      const onEventClick = vi.fn();
      const nov2026 = new Date(2026, 10, 1);

      render(
        <MonthView
          currentDate={nov2026}
          events={[mockEvent]}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />,
      );

      // Grid container
      const grid = screen.getByRole("grid", { name: "November 2026" });
      expect(grid).toBeDefined();

      // Rows (header row)
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThanOrEqual(1);

      // Column headers
      const colHeaders = screen.getAllByRole("columnheader");
      expect(colHeaders.length).toBe(7);

      // Grid cells
      const cells = screen.getAllByRole("gridcell");
      expect(cells.length).toBeGreaterThanOrEqual(28);
      expect(cells[0]).toHaveAttribute("tabindex", "0");

      // Activate day cell with Enter key
      fireEvent.keyDown(cells[0], { key: "Enter" });
      expect(onDateClick).toHaveBeenCalledTimes(1);

      // Event item in cell
      const eventBtn = screen.getByRole("button", {
        name: /10:00 AM: Sprint Planning/i,
      });
      expect(eventBtn).toHaveAttribute("tabindex", "0");

      // Activate event with Space key
      fireEvent.keyDown(eventBtn, { key: " " });
      expect(onEventClick).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("DayColumn Events", () => {
    it("renders event blocks with role=button, tabIndex=0, aria-label and triggers on Enter", () => {
      const onEventClick = vi.fn();
      const colData = {
        date: new Date(2026, 10, 4),
        events: [
          {
            ...mockEvent,
            top: 20,
            height: 10,
            left: 0,
            width: 100,
            column: 0,
            columnSpan: 1,
          },
        ],
      };

      render(<DayColumn column={colData} onEventClick={onEventClick} />);

      const eventBtn = screen.getByRole("button", {
        name: /10:00 AM: Sprint Planning/i,
      });
      expect(eventBtn).toHaveAttribute("tabindex", "0");

      fireEvent.keyDown(eventBtn, { key: "Enter" });
      expect(onEventClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "evt-1" }),
      );
    });
  });

  describe("EventOverflowPopover Events", () => {
    it("renders overflow events with role=button, tabIndex=0, aria-label and triggers on Enter", () => {
      const onEventClick = vi.fn();
      render(
        <EventOverflowPopover
          remainingEvents={[mockEvent]}
          day={new Date(2026, 10, 4)}
          onEventClick={onEventClick}
        />,
      );

      // Open popover
      const triggerBtn = screen.getByRole("button", { name: /\+1 more/i });
      fireEvent.click(triggerBtn);

      const eventBtn = screen.getByRole("button", {
        name: /10:00 AM: Sprint Planning/i,
      });
      expect(eventBtn).toHaveAttribute("tabindex", "0");

      fireEvent.keyDown(eventBtn, { key: "Enter" });
      expect(onEventClick).toHaveBeenCalledWith(mockEvent);
    });
  });
});
