import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Task } from "@/lib/types/task";

/**
 * Regression guard for the board DnD frame-drop fix.
 *
 * Root cause (confirmed by profiling): SortableBoardTaskCard forwarded
 * useSortable's `attributes`/`listeners` into the memoized TaskItem. dnd-kit
 * hands back fresh identities for those on every reorder, which broke
 * TaskItem's React.memo and forced EVERY board card's (expensive) TaskItem
 * subtree to re-render on every drag-over — the source of the frame drops.
 *
 * The board card never consumes those props (drag activation lives on the
 * wrapper div), so the fix is simply to stop forwarding them. This test fails
 * if they are ever re-introduced.
 */

const taskItemCalls: Record<string, unknown>[] = [];

vi.mock("@/components/tasks/TaskItem", () => {
  const Spy = (props: Record<string, unknown>) => {
    taskItemCalls.push(props);
    return <div data-testid="task-item" />;
  };
  return { __esModule: true, TaskItem: Spy, default: Spy };
});

import { SortableBoardTaskCard } from "@/components/tasks/SortableBoardTaskCard";

function makeTask(id: string, content: string): Task {
  return {
    id,
    user_id: "guest",
    content,
    description: null,
    is_completed: false,
    completed_at: null,
    priority: 4,
    project_id: "p1",
    day_order: 0,
    created_at: "2026-07-02T00:00:00.000Z",
    updated_at: "2026-07-02T00:00:00.000Z",
    due_date: "2026-07-02T12:00:00.000Z",
    do_date: null,
    is_evening: false,
    parent_id: null,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
  } as Task;
}

describe("SortableBoardTaskCard memoization", () => {
  beforeEach(() => {
    taskItemCalls.length = 0;
  });

  it("does not forward unstable drag props (attributes/listeners) into TaskItem", () => {
    render(
      <DndContext>
        <SortableContext items={["t1", "t2"]}>
          <SortableBoardTaskCard
            task={makeTask("t1", "Alpha")}
            project={{ color: "#000000", name: "Proj" }}
            isDesktop
          />
        </SortableContext>
      </DndContext>,
    );

    expect(taskItemCalls.length).toBeGreaterThan(0);
    const props = taskItemCalls[taskItemCalls.length - 1];
    // If these become defined again, TaskItem's memo will break on every
    // drag-over and the board frame drops return.
    expect(props.dragListeners).toBeUndefined();
    expect(props.dragAttributes).toBeUndefined();
    // Sanity: the card is still wired for the board render path.
    expect(props.viewMode).toBe("board");
  });
});
