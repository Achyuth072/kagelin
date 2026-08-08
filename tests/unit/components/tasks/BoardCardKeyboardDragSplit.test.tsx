import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Task } from "@/lib/types/task";

/**
 * Regression guard for issue 04 — dnd-kit's KeyboardSensor activates on
 * Space/Enter, the same keys TaskList binds to toggle-complete / open-sheet.
 * On desktop the fix confines dnd-kit's role/tabIndex/onKeyDown to a
 * dedicated drag handle so the card body no longer double-fires on those
 * keys; pointer dragging stays card-wide via the remaining listeners.
 */

vi.mock("@/components/tasks/TaskItem", () => {
  const Spy = () => <div data-testid="task-item" />;
  return { __esModule: true, TaskItem: Spy, default: Spy };
});

import { SortableBoardTaskCard } from "@/components/tasks/SortableBoardTaskCard";

function makeTask(id: string): Task {
  return {
    id,
    user_id: "guest",
    content: "Task",
    description: null,
    is_completed: false,
    completed_at: null,
    priority: 4,
    project_id: "p1",
    day_order: 0,
    created_at: "2026-07-02T00:00:00.000Z",
    updated_at: "2026-07-02T00:00:00.000Z",
    due_date: null,
    do_date: null,
    is_evening: false,
    parent_id: null,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
  } as Task;
}

function renderCard(isDesktop: boolean) {
  return render(
    <DndContext>
      <SortableContext items={["t1"]}>
        <SortableBoardTaskCard
          task={makeTask("t1")}
          project={undefined}
          isDesktop={isDesktop}
        />
      </SortableContext>
    </DndContext>,
  );
}

describe("SortableBoardTaskCard keyboard-drag / Vim key split", () => {
  it("desktop: card body carries no dnd-kit role/tabIndex; a single dedicated handle does", () => {
    const { container } = renderCard(true);

    const cardBody = container.querySelector(
      '[data-testid="task-item"]',
    )!.parentElement!;
    expect(cardBody.getAttribute("role")).toBeNull();
    expect(cardBody.getAttribute("tabindex")).toBeNull();

    const activators = container.querySelectorAll('[role="button"]');
    expect(activators.length).toBe(1);
    expect(activators[0]).not.toBe(cardBody);
    expect(activators[0].getAttribute("tabindex")).toBe("0");
  });

  it("mobile: card body keeps the full spread — no separate handle needed", () => {
    const { container } = renderCard(false);

    const cardBody = container.querySelector(
      '[data-testid="task-item"]',
    )!.parentElement!;
    expect(cardBody.getAttribute("role")).toBe("button");
    expect(cardBody.getAttribute("tabindex")).toBe("0");

    const activators = container.querySelectorAll('[role="button"]');
    expect(activators.length).toBe(1);
  });
});
