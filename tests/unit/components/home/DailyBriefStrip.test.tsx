import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyBriefStrip } from "@/components/home/DailyBriefStrip";
import { HomeClient } from "@/components/home/HomeClient";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";
import type { CalendarEvent } from "@/lib/types/calendar-event";

const mockPush = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    loading: false,
    isGuestMode: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

let mockTasks: Task[] = [];
let mockEvents: CalendarEvent[] = [];
let mockFocusCount = 0;

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({ data: mockTasks }),
}));

vi.mock("@/lib/hooks/useCalendarEventsList", () => ({
  useDedicatedCalendarEventsQuery: () => ({ data: mockEvents }),
}));

vi.mock("@/lib/hooks/useTodayFocusSessions", () => ({
  useTodayFocusSessions: () => ({ data: mockFocusCount }),
}));

vi.mock("@/components/tasks/TaskList", () => ({
  default: () => <div data-testid="consolidated-task-list" />,
}));

vi.mock("@/components/tasks/TasksPageHeader", () => ({
  TasksPageHeader: () => <div data-testid="tasks-page-header" />,
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));

vi.mock("@/components/home/PwaInstallHint", () => ({
  PwaInstallHint: () => null,
}));

vi.mock("@/components/home/StartHereCard", () => ({
  StartHereCard: () => null,
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("DailyBriefStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks = [];
    mockEvents = [];
    mockFocusCount = 0;
    useUiStore.setState({ showDailyBrief: true, timeFormat: "24h" });
  });

  it("renders 3 pills with empty-state copy and zero habit or streak text", () => {
    const { container } = renderWithQuery(<DailyBriefStrip />);

    expect(screen.getByTestId("daily-brief-strip")).toBeInTheDocument();
    expect(screen.getByText("All clear today")).toBeInTheDocument();
    expect(screen.getByText("No more events")).toBeInTheDocument();
    expect(screen.getByText("Start focus")).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/habit|streak/i);
  });

  it("renders today task counts, overdue count, next event, and focus count", () => {
    const now = new Date();
    const laterToday = new Date(now.getTime() + 60 * 60 * 1000);
    // Ensure laterToday is still the same day even near midnight
    if (laterToday.getDate() !== now.getDate()) {
      laterToday.setTime(now.getTime());
    }
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    mockTasks = [
      {
        id: "t1",
        user_id: "u1",
        content: "Today task",
        description: null,
        is_completed: false,
        completed_at: null,
        priority: 4,
        project_id: null,
        day_order: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        due_date: now.toISOString(),
        do_date: null,
        is_evening: false,
        parent_id: null,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
      },
      {
        id: "t2",
        user_id: "u1",
        content: "Overdue task",
        description: null,
        is_completed: false,
        completed_at: null,
        priority: 4,
        project_id: null,
        day_order: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        due_date: yesterday.toISOString(),
        do_date: null,
        is_completed_at: undefined,
        is_evening: false,
        parent_id: null,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
      } as Task,
    ];

    mockEvents = [
      {
        id: "e1",
        user_id: "u1",
        title: "Design Review",
        description: null,
        start_time: laterToday.toISOString(),
        end_time: new Date(laterToday.getTime() + 30 * 60 * 1000).toISOString(),
        all_day: false,
        color: "#4B6CB7",
        category: "work",
        is_archived: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      } as CalendarEvent,
    ];

    mockFocusCount = 2;

    renderWithQuery(<DailyBriefStrip />);

    expect(screen.getByText(/1 today/)).toBeInTheDocument();
    expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
    expect(screen.getByText("Design Review")).toBeInTheDocument();
    expect(screen.getByText("2 focus sessions today")).toBeInTheDocument();
  });

  it("hides when the dismiss button is clicked and updates useUiStore", () => {
    renderWithQuery(<HomeClient />);
    expect(screen.getByTestId("daily-brief-strip")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide Daily Brief" }));

    expect(useUiStore.getState().showDailyBrief).toBe(false);
    expect(screen.queryByTestId("daily-brief-strip")).not.toBeInTheDocument();
  });

  it("does not render in HomeClient when showDailyBrief is false", () => {
    useUiStore.setState({ showDailyBrief: false });
    renderWithQuery(<HomeClient />);

    expect(screen.queryByTestId("daily-brief-strip")).not.toBeInTheDocument();
  });
});
