import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeClient } from "@/components/home/HomeClient";
import { useUiStore } from "@/lib/store/uiStore";

const mockPush = vi.fn();
let mockUser: { id: string } | null = { id: "user-123" };
let mockLoading = false;
let mockSearchParams = new URLSearchParams();

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/components/tasks/TaskList", () => ({
  default: ({
    sortBy,
    groupBy,
    projectId,
    filter,
  }: {
    sortBy: string;
    groupBy: string;
    projectId: string;
    filter?: string;
  }) => (
    <div
      data-testid="consolidated-task-list"
      data-sort={sortBy}
      data-group={groupBy}
      data-project={projectId}
      data-filter={filter}
    >
      TaskList Component
    </div>
  ),
}));

vi.mock("@/components/tasks/TasksPageHeader", () => ({
  TasksPageHeader: ({
    currentSort,
    currentGroup,
    viewMode,
    onSortChange,
    onGroupChange,
    onViewModeChange,
  }: {
    currentSort: string;
    currentGroup: string;
    viewMode: string;
    onSortChange: (sort: string) => void;
    onGroupChange: (group: string) => void;
    onViewModeChange: (mode: string) => void;
  }) => (
    <div data-testid="tasks-page-header">
      <button onClick={() => onSortChange("priority")}>Change Sort</button>
      <button onClick={() => onGroupChange("date")}>Change Group</button>
      <button onClick={() => onViewModeChange("board")}>Change ViewMode</button>
      <span data-testid="header-sort">{currentSort}</span>
      <span data-testid="header-group">{currentGroup}</span>
      <span data-testid="header-view">{viewMode}</span>
    </div>
  ),
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

describe("HomeClient Architecture Consolidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "user-123" };
    mockLoading = false;
    mockSearchParams = new URLSearchParams();
    useUiStore.setState({
      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
    });
  });

  it("HC-01: Renders the single consolidated TaskList directly without SplitViewLayout", () => {
    render(<HomeClient />);

    expect(screen.getByTestId("consolidated-task-list")).toBeInTheDocument();
    // Verify no legacy split view layout wrapper
    expect(screen.queryByTestId("split-view-layout")).not.toBeInTheDocument();
  });

  it("HC-02: Forwards current sort, group, and route params to TaskList", () => {
    mockSearchParams = new URLSearchParams("project=work&filter=today");
    useUiStore.setState({ sortBy: "priority", groupBy: "project" });

    render(<HomeClient />);

    const taskList = screen.getByTestId("consolidated-task-list");
    expect(taskList).toHaveAttribute("data-sort", "priority");
    expect(taskList).toHaveAttribute("data-group", "project");
    expect(taskList).toHaveAttribute("data-project", "work");
    expect(taskList).toHaveAttribute("data-filter", "today");
  });

  it("HC-03: Displays loading state while auth is hydrating", () => {
    mockLoading = true;
    render(<HomeClient />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(
      screen.queryByTestId("consolidated-task-list"),
    ).not.toBeInTheDocument();
  });

  it("HC-04: Redirects unauthenticated users to /login", () => {
    mockUser = null;
    mockLoading = false;
    render(<HomeClient />);

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("HC-05: Updates UI store state when sort, group, or viewMode changes from header", () => {
    render(<HomeClient />);

    fireEvent.click(screen.getByText("Change Sort"));
    expect(useUiStore.getState().sortBy).toBe("priority");

    fireEvent.click(screen.getByText("Change Group"));
    expect(useUiStore.getState().groupBy).toBe("date");

    fireEvent.click(screen.getByText("Change ViewMode"));
    expect(useUiStore.getState().viewMode).toBe("board");
  });
});
