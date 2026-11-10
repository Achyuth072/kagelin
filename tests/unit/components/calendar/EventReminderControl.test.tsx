import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/components/AuthProvider";

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/lib/hooks/useProfile");
vi.mock("@/components/AuthProvider");
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));
vi.mock("@/lib/hooks/useCalendarEventMutations", () => ({
  useCreateCalendarEvent: () => ({ mutate: createMutate }),
  useUpdateCalendarEvent: () => ({ mutate: updateMutate }),
  useDeleteCalendarEvent: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/utils/nlp-event", () => ({
  parseEventInput: vi.fn(() => ({ start: null, end: null, allDay: false })),
}));
vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: vi.fn((selector: (s: { events: never[] }) => unknown) =>
    selector({ events: [] }),
  ),
}));

const defaultDate = new Date("2025-06-01T10:00:00");

function mockProfile(notifications: Record<string, unknown> = {}) {
  (useProfile as Mock).mockReturnValue({
    profile: { settings: { notifications } },
  });
}

async function openDialog(
  props: Partial<Parameters<typeof CreateEventDialog>[0]> = {},
) {
  render(
    <CreateEventDialog
      open
      onOpenChange={vi.fn()}
      defaultDate={defaultDate}
      {...props}
    />,
  );
  await act(async () => {
    vi.runAllTimers();
  });
}

async function submitWithTitle(title: string, buttonName = /create event/i) {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText(/add title/i), {
      target: { value: title },
    });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
  });
}

describe("CreateEventDialog — event reminder control", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createMutate.mockClear();
    updateMutate.mockClear();
    (useAuth as Mock).mockReturnValue({ isGuestMode: false });
    mockProfile({ event_reminders: true, event_reminder_minutes: 15 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the timed presets plus none", async () => {
    await openDialog();

    const reminderBtn = screen.getByLabelText("Reminder");
    expect(reminderBtn).toHaveAttribute(
      "aria-controls",
      "event-reminder-expansion",
    );
    expect(reminderBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(reminderBtn);
    expect(reminderBtn).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("group", { name: "Reminder options" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "No reminder",
      "At start",
      "5 minutes before",
      "10 minutes before",
      "15 minutes before",
      "30 minutes before",
      "1 hour before",
      "1 day before",
    ]);
  });

  it("offers only on the day and day before for an all-day event", async () => {
    await openDialog();
    fireEvent.click(document.getElementById("all-day")!);

    fireEvent.click(screen.getByLabelText("Reminder"));
    const group = screen.getByRole("group", { name: "Reminder options" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "No reminder",
      "On the day (9:00 AM)",
      "Day before (9:00 AM)",
    ]);
  });

  it("starts a new event on the profile default lead time", async () => {
    await openDialog();

    expect(screen.getByLabelText("Reminder")).toHaveTextContent(
      "15 minutes before",
    );
    await submitWithTitle("Standup");
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_minutes: 15 }),
    );
  });

  it("starts a new event with no reminder when the switch is off", async () => {
    mockProfile({ event_reminders: false, event_reminder_minutes: 15 });
    await openDialog();

    expect(screen.getByLabelText("Reminder")).toHaveTextContent("No reminder");
    await submitWithTitle("Standup");
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_minutes: null }),
    );
  });

  it("saves the chosen preset", async () => {
    await openDialog();
    fireEvent.click(screen.getByLabelText("Reminder"));
    fireEvent.click(screen.getByRole("button", { name: "1 hour before" }));

    expect(screen.getByLabelText("Reminder")).toHaveTextContent(
      "1 hour before",
    );
    await submitWithTitle("Standup");
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_minutes: 60 }),
    );
  });

  it("saves an edited reminder on an existing event", async () => {
    await openDialog({
      defaultDate: undefined,
      event: {
        id: "evt-1",
        title: "Existing",
        start: new Date("2025-06-01T10:00:00"),
        end: new Date("2025-06-01T11:00:00"),
        allDay: false,
        color: "#000",
        reminderMinutes: 5,
      },
    });

    expect(screen.getByLabelText("Reminder")).toHaveTextContent(
      "5 minutes before",
    );
    fireEvent.click(screen.getByLabelText("Reminder"));
    fireEvent.click(screen.getByRole("button", { name: "No reminder" }));
    expect(screen.getByLabelText("Reminder")).toHaveTextContent("No reminder");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-1", reminder_minutes: null }),
    );
  });

  it("disables the control for an event in a recurring series", async () => {
    await openDialog({
      defaultDate: undefined,
      event: {
        id: "evt-2",
        title: "Weekly sync",
        start: new Date("2025-06-01T10:00:00"),
        end: new Date("2025-06-01T11:00:00"),
        allDay: false,
        color: "#000",
        reminderMinutes: 10,
        metadata: { recurring_series_id: "series-1" },
      },
    });

    expect(screen.getByLabelText("Reminder")).toBeDisabled();
    expect(screen.getByLabelText("Reminder")).toHaveTextContent(
      "10 minutes before",
    );
  });

  it("shows a Guest the control with an account hint and stores no reminder", async () => {
    (useAuth as Mock).mockReturnValue({ isGuestMode: true });
    (useProfile as Mock).mockReturnValue({ profile: null });
    await openDialog();

    expect(screen.getByLabelText("Reminder")).toBeDisabled();
    expect(screen.getByText(/reminders need an account/i)).toBeInTheDocument();
    await submitWithTitle("Standup");
    const payload = createMutate.mock.calls[0][0];
    expect(payload.reminder_minutes).toBeUndefined();
  });
});
