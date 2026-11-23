import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeTickTickImport,
  rollbackTickTickImport,
  TickTickImportFailure,
  chunkArray,
} from "@/lib/import/ticktick/importTickTick";
import type { TickTickImportPreview } from "@/lib/import/ticktick/types";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import { persistImportSource } from "@/lib/mutations/importSource";

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/mutations/project", () => ({
  projectMutations: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/mutations/importSource", () => ({
  persistImportSource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/errors/diagnostics", () => ({
  recordDiagnosticError: vi.fn(),
}));

describe("executeTickTickImport & rollbackTickTickImport (Execution Engine)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let taskCounter = 0;
    vi.mocked(taskMutations.createMany).mockImplementation(async (inputs) => {
      return inputs.map((input) => ({
        id: input._clientId ?? `created-task-${++taskCounter}`,
        content: input.content,
        description: input.description ?? null,
        project_id: input.project_id ?? null,
        parent_id: input.parent_id ?? null,
        priority: input.priority ?? 4,
        due_date: input.due_date ?? null,
        do_date: input.do_date ?? null,
        is_evening: false,
        is_completed: input.is_completed ?? false,
        completed_at: input.completed_at ?? null,
        day_order: input.day_order ?? 0,
        recurrence: input.recurrence ?? null,
        recurring_series_id: null,
        reminder_days: 127,
        google_event_id: null,
        google_etag: null,
        user_id: "user-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    });

    vi.mocked(projectMutations.create).mockImplementation(async (input) => ({
      id: `proj-${input.name.toLowerCase().replace(/[\s/]+/g, "-")}`,
      name: input.name,
      color: input.color,
      view_style: "list",
      is_inbox: false,
      is_archived: false,
      user_id: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    vi.mocked(taskMutations.deleteMany).mockResolvedValue(undefined);
    vi.mocked(projectMutations.deleteMany).mockResolvedValue(undefined);
  });

  it("splits items into chunks of at most chunkSize", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkArray(items, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });

  it("captures provenance before task creation and executes chunked creation", async () => {
    const rootTempId = "root-temp-1";
    const subtaskTempId = "subtask-temp-1";

    const preview: TickTickImportPreview = {
      totalTasks: 2,
      rootTasksCount: 1,
      subtasksCount: 1,
      completedTasksCount: 0,
      recurringCount: 0,
      earliestDate: null,
      latestDate: null,
      projects: [
        {
          name: "Work / Launch",
          folderName: "Work",
          status: "new",
          isInbox: false,
          existingProjectId: null,
          color: "#00FF00",
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
          tasks: [
            {
              tempId: rootTempId,
              tempParentId: null,
              originalTaskId: "tt-root-1",
              originalParentId: null,
              content: "Launch Website",
              description: "Final checklist",
              priority: 1,
              dueDate: "2026-11-25T00:00:00.000Z",
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Launch",
              folderName: "Work",
              dayOrder: 1,
              originalDepth: 0,
            },
            {
              tempId: subtaskTempId,
              tempParentId: rootTempId,
              originalTaskId: "tt-sub-1",
              originalParentId: "tt-root-1",
              content: "Configure DNS",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Launch",
              folderName: "Work",
              dayOrder: 2,
              originalDepth: 1,
            },
          ],
        },
      ],
      parentRedirects: {},
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 1,
      mergedProjectCount: 0,
      isQuotaLimited: false,
      rawSource: {
        rows: [],
        csvContent: "Folder Name,List Name,Title...",
      },
    };

    const result = await executeTickTickImport(preview, {
      fileName: "backup.csv",
      isGuest: false,
    });

    expect(persistImportSource).toHaveBeenCalledWith(
      {
        source_app: "ticktick",
        file_name: "backup.csv",
        raw: preview.rawSource,
      },
      { isGuest: false },
    );

    expect(projectMutations.create).toHaveBeenCalledWith({
      name: "Work / Launch",
      color: "#00FF00",
    });

    expect(taskMutations.createMany).toHaveBeenCalledTimes(2);
    expect(result.importedCount).toBe(2);
    expect(result.createdProjectCount).toBe(1);

    const subtaskCallArgs = vi.mocked(taskMutations.createMany).mock
      .calls[1][0];
    const rootCallArgs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(subtaskCallArgs[0].parent_id).toBe(rootCallArgs[0]._clientId);
  });

  it("handles parentRedirects to existing Kagelin tasks for re-attached child steps", async () => {
    const preview: TickTickImportPreview = {
      totalTasks: 1,
      rootTasksCount: 0,
      subtasksCount: 1,
      completedTasksCount: 0,
      recurringCount: 0,
      earliestDate: null,
      latestDate: null,
      projects: [
        {
          name: "Work",
          folderName: null,
          status: "merged",
          isInbox: false,
          existingProjectId: "proj-existing-work",
          color: "#FF0000",
          duplicatesSkipped: 1,
          parentRedirects: {
            "skipped-root-temp": {
              kind: "existing",
              taskId: "existing-kagelin-root-id",
            },
          },
          subtasksReassigned: 1,
          tasks: [
            {
              tempId: "step-1",
              tempParentId: "skipped-root-temp",
              originalTaskId: "tt-step-1",
              originalParentId: "existing-kagelin-root-id",
              content: "Reattached Subtask",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Work",
              folderName: null,
              dayOrder: 1,
              originalDepth: 1,
            },
          ],
        },
      ],
      parentRedirects: {
        "skipped-root-temp": {
          kind: "existing",
          taskId: "existing-kagelin-root-id",
        },
      },
      duplicateTasksSkipped: 1,
      subtasksReassigned: 1,
      newProjectCount: 0,
      mergedProjectCount: 1,
      isQuotaLimited: false,
    };

    const result = await executeTickTickImport(preview);

    expect(projectMutations.create).not.toHaveBeenCalled();
    expect(taskMutations.createMany).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(callArgs[0].project_id).toBe("proj-existing-work");
    expect(callArgs[0].parent_id).toBe("existing-kagelin-root-id");
    expect(result.importedCount).toBe(1);
    expect(result.createdProjectCount).toBe(0);
  });

  it("respects includeCompleted: false by skipping completed tasks", async () => {
    const preview: TickTickImportPreview = {
      totalTasks: 2,
      rootTasksCount: 2,
      subtasksCount: 0,
      completedTasksCount: 1,
      recurringCount: 0,
      earliestDate: null,
      latestDate: null,
      projects: [
        {
          name: "Inbox",
          folderName: null,
          status: "inbox",
          isInbox: true,
          existingProjectId: null,
          color: "#000000",
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
          tasks: [
            {
              tempId: "task-active",
              tempParentId: null,
              originalTaskId: "1",
              originalParentId: null,
              content: "Active Task",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Inbox",
              folderName: null,
              dayOrder: 0,
              originalDepth: 0,
            },
            {
              tempId: "task-completed",
              tempParentId: null,
              originalTaskId: "2",
              originalParentId: null,
              content: "Completed Task",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: true,
              completedAt: "2026-11-20T00:00:00.000Z",
              recurrence: null,
              listName: "Inbox",
              folderName: null,
              dayOrder: 1,
              originalDepth: 0,
            },
          ],
        },
      ],
      parentRedirects: {},
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 0,
      mergedProjectCount: 0,
      isQuotaLimited: false,
    };

    const result = await executeTickTickImport(preview, {
      includeCompleted: false,
    });

    expect(taskMutations.createMany).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(callArgs).toHaveLength(1);
    expect(callArgs[0].content).toBe("Active Task");
    expect(result.importedCount).toBe(1);
  });

  it("triggers compensating rollback in reverse order when insertion fails", async () => {
    vi.mocked(taskMutations.createMany)
      .mockResolvedValueOnce([
        {
          id: "created-task-1",
          content: "Task 1",
          description: null,
          project_id: "proj-new",
          parent_id: null,
          priority: 4,
          due_date: null,
          do_date: null,
          is_evening: false,
          is_completed: false,
          completed_at: null,
          day_order: 0,
          recurrence: null,
          recurring_series_id: null,
          reminder_days: 127,
          google_event_id: null,
          google_etag: null,
          user_id: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .mockRejectedValueOnce(new Error("Database write failure"));

    const preview: TickTickImportPreview = {
      totalTasks: 2,
      rootTasksCount: 1,
      subtasksCount: 1,
      completedTasksCount: 0,
      recurringCount: 0,
      earliestDate: null,
      latestDate: null,
      projects: [
        {
          name: "Project Fail",
          folderName: null,
          status: "new",
          isInbox: false,
          existingProjectId: null,
          color: "#0000FF",
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
          tasks: [
            {
              tempId: "root-1",
              tempParentId: null,
              originalTaskId: "1",
              originalParentId: null,
              content: "Root 1",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Project Fail",
              folderName: null,
              dayOrder: 0,
              originalDepth: 0,
            },
            {
              tempId: "step-1",
              tempParentId: "root-1",
              originalTaskId: "2",
              originalParentId: "1",
              content: "Step 1",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Project Fail",
              folderName: null,
              dayOrder: 1,
              originalDepth: 1,
            },
          ],
        },
      ],
      parentRedirects: {},
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 1,
      mergedProjectCount: 0,
      isQuotaLimited: false,
    };

    await expect(executeTickTickImport(preview)).rejects.toThrow(
      TickTickImportFailure,
    );

    expect(taskMutations.deleteMany).toHaveBeenCalledWith(["created-task-1"]);
    expect(projectMutations.deleteMany).toHaveBeenCalledWith([
      "proj-project-fail",
    ]);
  });

  it("aborts and rolls back when signal is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    const preview: TickTickImportPreview = {
      totalTasks: 1,
      rootTasksCount: 1,
      subtasksCount: 0,
      completedTasksCount: 0,
      recurringCount: 0,
      earliestDate: null,
      latestDate: null,
      projects: [
        {
          name: "Inbox",
          folderName: null,
          status: "inbox",
          isInbox: true,
          existingProjectId: null,
          color: "#000000",
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
          tasks: [
            {
              tempId: "task-1",
              tempParentId: null,
              originalTaskId: "1",
              originalParentId: null,
              content: "Aborted Task",
              description: null,
              priority: 4,
              dueDate: null,
              doDate: null,
              is_completed: false,
              completedAt: null,
              recurrence: null,
              listName: "Inbox",
              folderName: null,
              dayOrder: 0,
              originalDepth: 0,
            },
          ],
        },
      ],
      parentRedirects: {},
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 0,
      mergedProjectCount: 0,
      isQuotaLimited: false,
    };

    await expect(
      executeTickTickImport(preview, { signal: controller.signal }),
    ).rejects.toThrow("Import aborted by user");
  });

  it("rolls back created tasks and projects via rollbackTickTickImport", async () => {
    const success = await rollbackTickTickImport(
      ["task-1", "task-2"],
      ["proj-1"],
    );
    expect(success).toBe(true);
    expect(taskMutations.deleteMany).toHaveBeenCalledWith(["task-2", "task-1"]);
    expect(projectMutations.deleteMany).toHaveBeenCalledWith(["proj-1"]);
  });
});
