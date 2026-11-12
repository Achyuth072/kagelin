import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

const mockDeleteMutate = vi.fn();
const mockCreateMutate = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/notify", () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

vi.mock("@/lib/hooks/useCalendarEventMutations", () => ({
  useCreateCalendarEvent: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateCalendarEvent: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteCalendarEvent: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { default_event_reminder_minutes: null } }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true), // desktop mode
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: vi.fn(),
}));

interface MockCalendarStoreState {
  selectedDate: Date;
  events: CalendarEventUI[];
}

interface MockLocationStoreState {
  locations: string[];
  getRecentLocations: () => string[];
  addLocation: (loc: string) => void;
}

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: (selector?: (s: MockCalendarStoreState) => unknown) => {
    const state: MockCalendarStoreState = {
      selectedDate: new Date(),
      events: [],
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/lib/store/locationHistoryStore", () => ({
  useLocationHistoryStore: (
    selector?: (s: MockLocationStoreState) => unknown,
  ) => {
    const state: MockLocationStoreState = {
      locations: [],
      getRecentLocations: () => [],
      addLocation: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

const mockEvent: CalendarEventUI = {
  id: "evt-123",
  title: "Team Standup",
  description: "Daily standup",
  location: "Meeting Room A",
  color: "#4B6CB7",
  isArchived: false,
  start: new Date("2026-11-04T10:00:00Z"),
  end: new Date("2026-11-04T10:30:00Z"),
  allDay: false,
};

describe("CreateEventDialog Deletion Safety & Confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prompts confirmation alert dialog when clicking delete, and does not immediately delete", async () => {
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        event={mockEvent}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /delete event/i });
    fireEvent.click(deleteBtn);

    // Should NOT have called delete mutation yet
    expect(mockDeleteMutate).not.toHaveBeenCalled();

    // Should show confirmation dialog
    expect(screen.getByText("Delete Event")).toBeDefined();
    expect(
      screen.getByText(/Are you sure you want to delete this event/i),
    ).toBeDefined();
  });

  it("deletes event and shows toast with Undo option upon confirmation", async () => {
    const onOpenChange = vi.fn();
    mockDeleteMutate.mockImplementation((id, options) => {
      options?.onSuccess?.();
    });

    render(
      <CreateEventDialog
        open={true}
        onOpenChange={onOpenChange}
        event={mockEvent}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /delete event/i });
    fireEvent.click(deleteBtn);

    // Click confirm in the alert dialog
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      "evt-123",
      expect.any(Object),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      "Event deleted",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Trigger Undo callback
    const undoAction = mockNotify.mock.calls[0][1].action;
    undoAction.onClick();

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Team Standup",
        location: "Meeting Room A",
      }),
    );
  });
});
