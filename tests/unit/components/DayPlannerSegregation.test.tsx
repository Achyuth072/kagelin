import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeClient } from "@/components/home/HomeClient";
import { TaskListView } from "@/components/tasks/TaskListView";
import { HabitCard } from "@/components/habits/HabitCard";
import { composeBriefing } from "../../../supabase/functions/_shared/compose-briefing";
import type { Task } from "@/lib/types/task";
import type { HabitWithEntries } from "@/lib/types/habit";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/tasks/TaskList", () => ({
  default: () => <div data-testid="tasks-day-surface">Tasks Day Surface</div>,
}));

vi.mock("@/components/tasks/TasksPageHeader", () => ({
  TasksPageHeader: () => <div data-testid="tasks-page-header" />,
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/home/PwaInstallHint", () => ({
  PwaInstallHint: () => null,
}));

vi.mock("@/components/home/StartHereCard", () => ({
  StartHereCard: () => null,
}));

vi.mock("@/lib/hooks/useIsMobile");
vi.mock("@/lib/hooks/useHabitMutations");

const makeTask = (
  id: string,
  content: string,
  isCompleted: boolean = false,
): Task => ({
  id,
  user_id: "user-1",
  content,
  description: null,
  is_completed: isCompleted,
  completed_at: isCompleted ? "2026-06-25T10:00:00Z" : null,
  priority: 4,
  project_id: null,
  day_order: 0,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
});

describe("Day-Planner Orthogonality & Segregation Verification", () => {
  it("verifies day surface presents tasks in a dedicated module without habit interleaving", () => {
    const { container } = render(<HomeClient />);
    expect(screen.getByTestId("tasks-day-surface")).toBeInTheDocument();
    expect(container.querySelector("[data-testid*='habit']")).toBeNull();
    expect(screen.queryByText(/habit/i)).not.toBeInTheDocument();
  });

  it("verifies daily briefing presents tasks and habits in separate non-interleaved counts", () => {
    const brief = composeBriefing({
      kind: "morning",
      counts: {
        tasksToday: 3,
        overdue: 1,
        dueToday: 2,
        eventsToday: 1,
        habitsPending: 4,
      },
    });

    expect(brief?.body).toBe(
      "You have 3 tasks, 1 overdue, 2 due today, 1 event, 4 habits pending.",
    );
  });

  it("verifies completing a task collapses it into the completed section", () => {
    const activeTask = makeTask("active-1", "Active finite task", false);
    const completedTask = makeTask("done-1", "Finished task item", true);

    const processedTasks: ProcessedTasks = {
      active: [activeTask],
      evening: [],
      completed: [completedTask],
      groups: null,
    };

    renderWithQuery(
      <TaskListView
        processedTasks={processedTasks}
        activeTasks={[activeTask]}
        eveningTasks={[]}
        groupTasks={null}
        handleTaskClick={vi.fn()}
        keyboardSelectedId={null}
        isDndActive={false}
        projectsMap={new Map()}
        isDesktop={true}
        triggerHaptic={vi.fn()}
        setActiveTaskId={vi.fn()}
      />,
    );

    expect(screen.getByText("Active finite task")).toBeInTheDocument();
    // Completed section is rendered separately for finished tasks
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Finished task item")).toBeInTheDocument();
  });

  it("verifies completing a habit keeps the satisfied progress in place without collapsing", () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);

    const todayStr = new Date().toISOString().split("T")[0];
    const habit: HabitWithEntries = {
      id: "habit-ongoing",
      user_id: "user-1",
      name: "Meditation Practice",
      description: "Daily mindfulness",
      color: "#10b981",
      icon: "Sparkles",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2026-01-01",
      sort_order: 0,
      target_value: 1,
      entries: [
        {
          id: "entry-today",
          habit_id: "habit-ongoing",
          date: todayStr,
          value: 1,
          created_at: "2026-06-25T08:00:00Z",
        },
      ],
    };

    renderWithQuery(<HabitCard habit={habit} />);

    // Habit card remains mounted in place with its title
    expect(screen.getByText("Meditation Practice")).toBeInTheDocument();

    // The satisfied status button is permanently visible in place
    const satisfiedButton = screen.getByRole("button", {
      name: /Today,.*done/i,
    });
    expect(satisfiedButton).toBeInTheDocument();
    expect(satisfiedButton).toHaveStyle({ backgroundColor: "#10b981" });
  });
});
