import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { CommandMenu } from "@/components/command-menu";

// Mock dependencies
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const mockTasks = Array.from({ length: 20 }, (_, i) => ({
  id: `task-${i + 1}`,
  content: `Task Item ${i + 1}`,
  is_completed: false,
  user_id: "user-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

const mockHabits = Array.from({ length: 15 }, (_, i) => ({
  id: `habit-${i + 1}`,
  name: `Habit Item ${i + 1}`,
  icon: "check",
  color: "#4B6CB7",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

const mockEvents = Array.from({ length: 12 }, (_, i) => ({
  id: `event-${i + 1}`,
  title: `Event Item ${i + 1}`,
  date: "2026-11-11T10:00:00.000Z",
  category: "work",
  user_id: "user-1",
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({ data: mockTasks }),
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => ({ data: mockHabits }),
}));

vi.mock("@/lib/hooks/useCalendarEventsList", () => ({
  useCalendarEventsList: () => mockEvents,
}));

vi.mock("@/lib/hooks/useAddMeetKagelin", () => ({
  useAddMeetKagelin: () => ({ addAndOpen: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    signOut: vi.fn(),
    isGuestMode: false,
  }),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));

vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({ openCreateProject: vi.fn() }),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), openEditHabit: vi.fn() }),
}));

vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: () => ({ openSheet: vi.fn() }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn() }),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({ openCreateEvent: vi.fn(), setDate: vi.fn() }),
}));

// Mock ResizeObserver for cmdk
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = function () {};

describe("CommandMenu bounds and prefix filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty-query filter shortcuts when search is empty", () => {
    render(<CommandMenu open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Filter Tasks (t:)")).toBeInTheDocument();
    expect(screen.getByText("Filter Habits (h:)")).toBeInTheDocument();
    expect(screen.getByText("Filter Events (e:)")).toBeInTheDocument();
  });

  it("caps results at maximum 8 items per section on general query", () => {
    render(<CommandMenu open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: "Item" } });

    // The mock data has 20 tasks, 15 habits, 12 events.
    // Each group should be bounded to 8.
    const renderedTaskItems = screen.getAllByText(/^Task Item \d+/);
    expect(renderedTaskItems.length).toBeLessThanOrEqual(8);

    const renderedHabitItems = screen.getAllByText(/^Habit Item \d+/);
    expect(renderedHabitItems.length).toBeLessThanOrEqual(8);

    const renderedEventItems = screen.getAllByText(/^Event Item \d+/);
    expect(renderedEventItems.length).toBeLessThanOrEqual(8);
  });

  it("filters exclusively to tasks when t: prefix is used", () => {
    render(<CommandMenu open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: "t: Item" } });

    const renderedTaskItems = screen.getAllByText(/^Task Item \d+/);
    expect(renderedTaskItems.length).toBeGreaterThan(0);
    expect(renderedTaskItems.length).toBeLessThanOrEqual(8);

    expect(screen.queryByText(/^Habit Item \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Event Item \d+/)).not.toBeInTheDocument();
  });

  it("filters exclusively to habits when h: prefix is used", () => {
    render(<CommandMenu open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: "h: Item" } });

    const renderedHabitItems = screen.getAllByText(/^Habit Item \d+/);
    expect(renderedHabitItems.length).toBeGreaterThan(0);
    expect(renderedHabitItems.length).toBeLessThanOrEqual(8);

    expect(screen.queryByText(/^Task Item \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Event Item \d+/)).not.toBeInTheDocument();
  });

  it("filters exclusively to events when e: prefix is used", () => {
    render(<CommandMenu open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: "e: Item" } });

    const renderedEventItems = screen.getAllByText(/^Event Item \d+/);
    expect(renderedEventItems.length).toBeGreaterThan(0);
    expect(renderedEventItems.length).toBeLessThanOrEqual(8);

    expect(screen.queryByText(/^Task Item \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Habit Item \d+/)).not.toBeInTheDocument();
  });
});
