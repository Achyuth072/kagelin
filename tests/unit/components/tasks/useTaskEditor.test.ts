import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskEditor } from "@/components/tasks/useTaskEditor";
import type { Task } from "@/lib/types/task";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
    isPhone: false,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

describe("useTaskEditor", () => {
  const mockCreateMutate = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();

  const mockTask: Task = {
    id: "task-100",
    content: "Existing Task Title",
    description: "Existing Description",
    priority: 2,
    is_completed: false,
    created_at: new Date().toISOString(),
    user_id: "user-1",
    project_id: "project-1",
  } as Task;

  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    });
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });
    (useDeleteTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });
    (useInboxProject as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { id: "inbox-123" },
    });
    (useProjects as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: "project-1", name: "Project One" }],
    });
  });

  it("initializes in edit mode when a task is provided", async () => {
    const { result } = renderHook(() =>
      useTaskEditor({ task: mockTask, autoFocusTitle: false }),
    );

    expect(result.current.mode).toBe("edit");
    expect(result.current.content).toBe("Existing Task Title");
    expect(result.current.description).toBe("Existing Description");
    expect(result.current.priority).toBe(2);
    expect(result.current.autoFocusTitle).toBe(false);
  });

  it("initializes in create mode when task is null", async () => {
    const initialDate = new Date("2026-11-05T00:00:00Z");
    const { result } = renderHook(() =>
      useTaskEditor({
        task: null,
        initialContent: "Initial Draft",
        initialDate,
        autoFocusTitle: true,
      }),
    );

    expect(result.current.mode).toBe("create");
    expect(result.current.content).toBe("Initial Draft");
    expect(result.current.dueDate?.toISOString()).toBe(
      initialDate.toISOString(),
    );
    expect(result.current.autoFocusTitle).toBe(true);
  });

  it("updates task and flushes uncommitted subtask step on submit", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditor({ task: mockTask, onClose }),
    );

    act(() => {
      result.current.setContent("Updated Title");
      result.current.setPendingStep("Pending subtask to flush");
    });

    await act(async () => {
      result.current.onSubmit();
    });

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "task-100",
          content: "Updated Title",
        }),
      );
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Pending subtask to flush",
          parent_id: "task-100",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("creates task and flushes all draft steps on submit in create mode", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useTaskEditor({ task: null, onClose }));

    act(() => {
      result.current.setContent("New Task Title");
      result.current.setDraftSubtasks(["Step 1", "Step 2"]);
      result.current.setPendingStep("Step 3 typed");
    });

    await act(async () => {
      result.current.onSubmit();
    });

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "New Task Title",
        }),
      );
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Step 1",
        }),
      );
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Step 2",
        }),
      );
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Step 3 typed",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("preserves unreadable encrypted field values via omitUntouchedUnreadable", async () => {
    const unreadableTask = {
      ...mockTask,
      description: "",
      unreadable: ["description"],
    } as unknown as Task;

    const { result } = renderHook(() =>
      useTaskEditor({ task: unreadableTask }),
    );

    act(() => {
      result.current.setContent("Updated only content");
    });

    await act(async () => {
      result.current.onSubmit();
    });

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalled();
      const updatedData = mockUpdateMutate.mock.calls[0][0];
      // Untouched description should be omitted so server doesn't overwrite encrypted text
      expect(updatedData.description).toBeUndefined();
      expect(updatedData.content).toBe("Updated only content");
    });
  });

  it("handles delete request and confirmation flow", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditor({ task: mockTask, onClose }),
    );

    expect(result.current.showDeleteDialog).toBe(false);

    act(() => {
      result.current.onDeleteRequest();
    });
    expect(result.current.showDeleteDialog).toBe(true);

    act(() => {
      result.current.onConfirmDelete();
    });

    expect(mockHapticTrigger).toHaveBeenCalledWith("thud");
    expect(mockDeleteMutate).toHaveBeenCalledWith("task-100");
    expect(onClose).toHaveBeenCalled();
    expect(result.current.showDeleteDialog).toBe(false);
  });

  it("handles keyboard shortcuts: Cmd+Enter submits, Escape closes", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditor({ task: mockTask, onClose }),
    );

    const preventDefault = vi.fn();
    act(() => {
      result.current.onKeyDown({
        key: "Enter",
        metaKey: true,
        preventDefault,
      } as unknown as React.KeyboardEvent);
    });
    expect(preventDefault).toHaveBeenCalled();

    act(() => {
      result.current.onKeyDown({
        key: "Escape",
      } as unknown as React.KeyboardEvent);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("resets state when task prop changes", async () => {
    let currentTask = mockTask;
    const { result, rerender } = renderHook(() =>
      useTaskEditor({ task: currentTask }),
    );

    expect(result.current.content).toBe("Existing Task Title");

    act(() => {
      result.current.setPendingStep("Transient pending step");
    });
    expect(result.current.pendingStep).toBe("Transient pending step");

    const newTask = {
      ...mockTask,
      id: "task-200",
      content: "Brand New Task",
    };
    currentTask = newTask;
    rerender();

    await waitFor(() => {
      expect(result.current.content).toBe("Brand New Task");
      expect(result.current.pendingStep).toBe("");
    });
  });
});
