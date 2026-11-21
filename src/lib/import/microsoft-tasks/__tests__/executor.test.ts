import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeMicrosoftTasksImport,
  rollbackMicrosoftTasksImport,
  MicrosoftTasksImportFailure,
  chunkArray,
} from "../executor";
import { planMicrosoftTasksImport } from "../plan";
import type { MicrosoftTasksDataset, ExistingWorkspace } from "../types";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/mutations/project", () => ({
  projectMutations: {
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/errors/diagnostics", () => ({
  recordDiagnosticError: vi.fn(),
}));

describe("executeMicrosoftTasksImport & rollbackMicrosoftTasksImport", () => {
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
        do_date: null,
        is_evening: false,
        is_completed: input.is_completed ?? false,
        completed_at: input.completed_at ?? null,
        day_order: input.day_order ?? 0,
        recurrence: null,
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
      id: `proj-${input.name.toLowerCase().replace(/\s+/g, "-")}`,
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
    vi.mocked(projectMutations.delete).mockResolvedValue(undefined);
  });

  it("splits items into chunks of at most chunkSize", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkArray(items, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });

  it("preserves completion status, completed_at, priority, and day_order", async () => {
    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "list-1",
          displayName: "Work",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-1": [
          {
            id: "t1",
            title: "Urgent fix",
            importance: "high",
            status: "completed",
            completedDateTime: {
              dateTime: "2026-11-21T10:00:00.0000000",
              timeZone: "UTC",
            },
            checklistItems: [
              {
                id: "step-1",
                displayName: "Review diff",
                isChecked: true,
                checkedDateTime: "2026-11-21T09:30:00.0000000",
              },
            ],
            isReminderOn: false,
          },
        ],
      },
    };

    const preview = planMicrosoftTasksImport(dataset);
    const result = await executeMicrosoftTasksImport(preview);

    expect(result.createdProjectCount).toBe(1);
    expect(result.importedCount).toBe(2); // 1 root + 1 step

    expect(projectMutations.create).toHaveBeenCalledWith({
      name: "Work",
      color: expect.any(String),
    });

    // 2 calls to taskMutations.createMany: roots first, then steps
    expect(taskMutations.createMany).toHaveBeenCalledTimes(2);

    const rootCallArgs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(rootCallArgs[0]).toMatchObject({
      content: "Urgent fix",
      priority: 1,
      is_completed: true,
      completed_at: "2026-11-21T10:00:00.000Z",
      project_id: "proj-work",
    });

    const stepCallArgs = vi.mocked(taskMutations.createMany).mock.calls[1][0];
    expect(stepCallArgs[0]).toMatchObject({
      content: "Review diff",
      priority: 4,
      is_completed: true,
      completed_at: "2026-11-21T09:30:00.000Z",
      project_id: "proj-work",
      parent_id: rootCallArgs[0]._clientId,
    });
  });

  it("redirects steps to existing Kagelin task ID when root was duplicate", async () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-kagelin-task-99",
          content: "Deploy app",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
      ],
    };

    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "list-1",
          displayName: "Work",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-1": [
          {
            id: "ms-dup-root",
            title: "Deploy app",
            status: "notStarted",
            checklistItems: [
              {
                id: "ms-step-1",
                displayName: "Run smoke test",
                isChecked: false,
              },
            ],
            importance: "normal",
            isReminderOn: false,
          },
        ],
      },
    };

    const preview = planMicrosoftTasksImport(dataset, workspace);
    const result = await executeMicrosoftTasksImport(preview);

    expect(projectMutations.create).not.toHaveBeenCalled(); // merged into existing
    expect(result.createdProjectCount).toBe(0);
    expect(result.importedCount).toBe(1); // only the step was imported

    expect(taskMutations.createMany).toHaveBeenCalledTimes(1);
    const stepCall = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(stepCall[0].parent_id).toBe("existing-kagelin-task-99");
  });

  it("commits tasks in bounded chunks of <= 100", async () => {
    const rootTasks = Array.from({ length: 150 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
      importance: "normal" as const,
      status: "notStarted" as const,
      checklistItems: [],
      isReminderOn: false,
    }));

    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "list-bulk",
          displayName: "Bulk List",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-bulk": rootTasks,
      },
    };

    const preview = planMicrosoftTasksImport(dataset);
    const result = await executeMicrosoftTasksImport(preview);

    expect(result.importedCount).toBe(150);
    // 150 roots should be split into 2 chunks: 100 and 50
    expect(taskMutations.createMany).toHaveBeenCalledTimes(2);
    expect(vi.mocked(taskMutations.createMany).mock.calls[0][0]).toHaveLength(
      100,
    );
    expect(vi.mocked(taskMutations.createMany).mock.calls[1][0]).toHaveLength(
      50,
    );
  });

  it("rolls back created tasks and created projects upon error, never deleting merged projects", async () => {
    const workspace: ExistingWorkspace = {
      projects: [
        { id: "existing-proj-id", name: "Existing Proj", is_inbox: false },
      ],
      tasks: [],
    };

    const dataset: MicrosoftTasksDataset = {
      lists: [
        // 1. Existing project merged
        {
          id: "list-1",
          displayName: "Existing Proj",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
        // 2. Net-new project created
        {
          id: "list-2",
          displayName: "Brand New Proj",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-1": [
          {
            id: "t1",
            title: "Task in merged",
            importance: "normal",
            status: "notStarted",
            checklistItems: [],
            isReminderOn: false,
          },
        ],
        "list-2": [
          {
            id: "t2",
            title: "Task in new proj",
            importance: "normal",
            status: "notStarted",
            checklistItems: [],
            isReminderOn: false,
          },
        ],
      },
    };

    const preview = planMicrosoftTasksImport(dataset, workspace);

    // Make the second task insertion fail
    let callCount = 0;
    vi.mocked(taskMutations.createMany).mockImplementation(async (inputs) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Database network failure");
      }
      return inputs.map((input) => ({
        id: input._clientId ?? "t1-id",
        content: input.content,
        description: null,
        project_id: input.project_id ?? null,
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
      }));
    });

    await expect(executeMicrosoftTasksImport(preview)).rejects.toThrow(
      MicrosoftTasksImportFailure,
    );

    // Rollback should have deleted the first created task
    expect(taskMutations.deleteMany).toHaveBeenCalledWith([expect.any(String)]);
    // Rollback should have deleted newly created "Brand New Proj"
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-brand-new-proj");
    // Rollback must NEVER delete existing project!
    expect(projectMutations.delete).not.toHaveBeenCalledWith(
      "existing-proj-id",
    );
  });

  it("handles AbortSignal cancellation during execution", async () => {
    const controller = new AbortController();

    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "list-1",
          displayName: "Abort Test",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-1": [
          {
            id: "t1",
            title: "Task 1",
            importance: "normal",
            status: "notStarted",
            checklistItems: [],
            isReminderOn: false,
          },
        ],
      },
    };

    const preview = planMicrosoftTasksImport(dataset);

    // Abort before start
    controller.abort();

    await expect(
      executeMicrosoftTasksImport(preview, { signal: controller.signal }),
    ).rejects.toThrow(/aborted by user/i);

    expect(projectMutations.create).not.toHaveBeenCalled();
    expect(taskMutations.createMany).not.toHaveBeenCalled();
  });

  it("directly rolls back created tasks and created projects via rollbackMicrosoftTasksImport", async () => {
    const taskIds = Array.from({ length: 150 }, (_, i) => `task-${i}`);
    const projectIds = ["proj-1", "proj-2"];

    const success = await rollbackMicrosoftTasksImport(taskIds, projectIds);

    expect(success).toBe(true);
    // 150 tasks rolled back in chunks of 100 (reverse order)
    expect(taskMutations.deleteMany).toHaveBeenCalledTimes(2);
    expect(projectMutations.delete).toHaveBeenCalledTimes(2);
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-2");
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-1");
  });

  it("safely handles includeCompleted=false when completed root has steps without leaking Graph string ID", async () => {
    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "list-1",
          displayName: "Work",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-1": [
          {
            id: "ms-graph-completed-root",
            title: "Completed Task",
            importance: "normal",
            status: "completed",
            checklistItems: [
              {
                id: "step-1",
                displayName: "Incomplete step under completed root",
                isChecked: false,
              },
            ],
            isReminderOn: false,
          },
        ],
      },
    };

    const preview = planMicrosoftTasksImport(dataset);
    const result = await executeMicrosoftTasksImport(preview, {
      includeCompleted: false,
    });

    expect(result.importedCount).toBe(0);
    const createCalls = vi.mocked(taskMutations.createMany).mock.calls;
    for (const [batch] of createCalls) {
      for (const item of batch) {
        expect(item.parent_id).not.toBe("ms-graph-completed-root");
      }
    }
  });
});
