import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { EventView } from "@/components/calendar/EventView";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: false,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false }),
}));

vi.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => ({ profile: null }),
}));

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/lib/hooks/useCalendarEventMutations", () => ({
  useCreateCalendarEvent: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateCalendarEvent: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useDeleteCalendarEvent: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock("@/lib/utils/nlp-event", () => ({
  parseEventInput: vi.fn(() => ({
    start: null,
    end: null,
    allDay: false,
  })),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: vi.fn((selector: (s: { events: never[] }) => unknown) =>
    selector({ events: [] }),
  ),
}));

const defaultDate = new Date("2026-11-10T10:00:00");

const sampleEvent = {
  id: "evt-789",
  title: "Sprint Planning",
  description: "Quarterly sprint backlog review",
  location: "Zoom",
  start: new Date("2026-11-10T10:00:00"),
  end: new Date("2026-11-10T11:00:00"),
  allDay: false,
  color: "#4B6CB7",
  calendarId: "cal-main",
};

async function flushResetTimer() {
  await act(async () => {
    vi.runAllTimers();
  });
}

describe("EventView standalone component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders in create mode without requiring an enclosing dialog", async () => {
    render(<EventView defaultDate={defaultDate} onClose={vi.fn()} />);
    await flushResetTimer();

    expect(screen.getByTestId("event-header-badge")).toHaveTextContent(
      "EVENT-NEW",
    );
    expect(screen.getByPlaceholderText(/add title/i)).toBeInTheDocument();
    expect(screen.getByTestId("property-strip")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create event/i }),
    ).toBeDisabled();
  });

  it("renders in edit mode and populates existing event data", async () => {
    render(<EventView event={sampleEvent} onClose={vi.fn()} />);
    await flushResetTimer();

    expect(screen.getByTestId("event-header-badge")).toHaveTextContent(
      "EVENT-789",
    );
    expect(screen.getByPlaceholderText(/add title/i)).toHaveValue(
      "Sprint Planning",
    );
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /delete event/i }),
    ).toBeInTheDocument();
  });

  it("triggers onClose upon successful form submission", async () => {
    const onClose = vi.fn();
    render(<EventView defaultDate={defaultDate} onClose={onClose} />);
    await flushResetTimer();

    const titleInput = screen.getByPlaceholderText(/add title/i);
    fireEvent.change(titleInput, { target: { value: "New Design Sync" } });

    const submitBtn = screen.getByRole("button", { name: /create event/i });
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Design Sync",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
