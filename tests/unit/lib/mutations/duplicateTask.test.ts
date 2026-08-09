import { describe, it, expect, beforeEach } from "vitest";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";

describe("taskMutations.duplicate", () => {
  beforeEach(() => {
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("duplicates a task and strips recurring_series_id and recurrence", async () => {
    const originalTask = mockStore.addTask({
      content: "Recurring Task",
      description: "Original description",
      priority: 2,
      due_date: "2026-08-10T10:00:00.000Z",
      recurrence: { freq: "DAILY", interval: 1 },
      recurring_series_id: "series-12345",
    });

    const duplicatedTask = await taskMutations.duplicate(originalTask);

    expect(duplicatedTask.id).not.toBe(originalTask.id);
    expect(duplicatedTask.content).toBe("Recurring Task");
    expect(duplicatedTask.description).toBe("Original description");
    expect(duplicatedTask.priority).toBe(2);
    expect(duplicatedTask.due_date).toBe("2026-08-10T10:00:00.000Z");
    expect(duplicatedTask.recurring_series_id).toBeNull();
    expect(duplicatedTask.recurrence).toBeNull();
  });

  it("deeply copies subtasks linked to the new duplicated parent ID", async () => {
    const parentTask = mockStore.addTask({
      content: "Parent Task",
    });

    const subtask1 = mockStore.addTask({
      content: "Subtask 1",
      parent_id: parentTask.id,
      priority: 1,
    });

    const subtask2 = mockStore.addTask({
      content: "Subtask 2",
      parent_id: parentTask.id,
      priority: 3,
    });

    // Sub-subtask
    const nestedSubtask = mockStore.addTask({
      content: "Nested Subtask",
      parent_id: subtask1.id,
    });

    const duplicatedParent = await taskMutations.duplicate(parentTask);

    expect(duplicatedParent.id).not.toBe(parentTask.id);

    const allTasks = mockStore.getTasks();
    const copiedSubtasks = allTasks.filter(
      (t) => t.parent_id === duplicatedParent.id,
    );

    expect(copiedSubtasks.length).toBe(2);
    expect(copiedSubtasks.map((s) => s.content)).toContain("Subtask 1");
    expect(copiedSubtasks.map((s) => s.content)).toContain("Subtask 2");

    // Verify subtask IDs are unique
    expect(copiedSubtasks.map((s) => s.id)).not.toContain(subtask1.id);
    expect(copiedSubtasks.map((s) => s.id)).not.toContain(subtask2.id);

    // Verify nested subtask was copied under the new Subtask 1
    const copiedSub1 = copiedSubtasks.find((s) => s.content === "Subtask 1");
    expect(copiedSub1).toBeDefined();

    const copiedNested = allTasks.filter((t) => t.parent_id === copiedSub1?.id);
    expect(copiedNested.length).toBe(1);
    expect(copiedNested[0].content).toBe("Nested Subtask");
    expect(copiedNested[0].id).not.toBe(nestedSubtask.id);
  });
});
