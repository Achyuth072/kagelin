import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { BoardViewSkeleton } from "@/components/tasks/TaskList";
import { CompletedTasksSheet } from "@/components/tasks/CompletedTasksSheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockTasksReturn = {
  data: [] as unknown[],
  isLoading: true,
};

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => mockTasksReturn,
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useClearCompletedTasks: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/hooks/useTimeFormat", () => ({
  useTimeFormat: () => ({ timeFormat: "12h" }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: () => undefined,
}));

describe("Skeletons & Transitions", () => {
  it("renders BoardViewSkeleton with 3 columns", () => {
    render(<BoardViewSkeleton />);
    const boardSkeleton = screen.getByTestId("board-view-skeleton");
    expect(boardSkeleton).toBeInTheDocument();
    expect(boardSkeleton.children).toHaveLength(3);
  });

  it("renders 4 skeleton rows in CompletedTasksSheet while loading", () => {
    mockTasksReturn = {
      data: [],
      isLoading: true,
    };

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CompletedTasksSheet open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    const skeletonContainer = screen.getByTestId("completed-tasks-skeleton");
    expect(skeletonContainer).toBeInTheDocument();
    expect(skeletonContainer.children).toHaveLength(4);
  });

  it("renders EmptyState in CompletedTasksSheet when no tasks are completed", () => {
    mockTasksReturn = {
      data: [],
      isLoading: false,
    };

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CompletedTasksSheet open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("No Completed Tasks")).toBeInTheDocument();
    expect(
      screen.getByText(/Tasks you complete will appear here/),
    ).toBeInTheDocument();
  });
});
