import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeGoogleTasksImport,
  rollbackGoogleTasksImport,
  GoogleTasksImportFailure,
} from "../importGoogleTasks";
import { planGoogleTasksImport } from "../plan";
import type { GoogleTasksDataset, ExistingWorkspace } from "../types";
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
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/errors/diagnostics", () => ({
  recordDiagnosticError: vi.fn(),
}));

describe("executeGoogleTasksImport & rollbackGoogleTasksImport", () => {
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
        priority: 4,
        due_date: input.due_date ?? null,
        do_date: null,
        is_evening: false,
        is_completed: false,
        completed_at: null,
        day_order: 0,
        recurrence: null,
        recurring_series_id: null,
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
    vi.mocked(projectMutations.deleteMany).mockResolvedValue(undefined);
  });

  it("preserves completion state, completed_at, and day_order in taskMutations.createMany inputs", async () => {
    const dataset: GoogleTasksDataset = {
      lists: [{ id: "@default", title: "My Tasks" }],
      tasksByListId: {
        "@default": [
          {
            id: "t1",
            title: "Task 1",
            status: "completed",
            completed: "2026-11-20T12:00:00.000Z",
            position: "00000000000000000001",
          },
          {
            id: "t2",
            title: "Task 2",
            status: "needsAction",
            position: "00000000000000000002",
          },
        ],
      },
    };

    const preview = planGoogleTasksImport(dataset);
    const result = await executeGoogleTasksImport(preview, { isGuest: false });

    expect(result.importedCount).toBe(2);
    expect(taskMutations.createMany).toHaveBeenCalledTimes(1);
    const inputs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(inputs[0].is_completed).toBe(true);
    expect(inputs[0].completed_at).toBe("2026-11-20T12:00:00.000Z");
    expect(inputs[0].day_order).toBe(0);

    expect(inputs[1].is_completed).toBe(false);
    expect(inputs[1].completed_at).toBeUndefined();
    expect(inputs[1].day_order).toBe(1);
  });

  it("filters out completed tasks when includeCompleted is false", async () => {
    const dataset: GoogleTasksDataset = {
      lists: [{ id: "@default", title: "My Tasks" }],
      tasksByListId: {
        "@default": [
          {
            id: "t1",
            title: "Completed Task",
            status: "completed",
          },
          {
            id: "t2",
            title: "Active Task",
            status: "needsAction",
          },
        ],
      },
    };

    const preview = planGoogleTasksImport(dataset);
    const result = await executeGoogleTasksImport(preview, {
      isGuest: false,
      includeCompleted: false,
    });

    expect(result.importedCount).toBe(1);
    expect(taskMutations.createMany).toHaveBeenCalledTimes(1);
    const inputs = vi.mocked(taskMutations.createMany).mock.calls[0][0];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].content).toBe("Active Task");
    expect(inputs[0].is_completed).toBe(false);
  });

  it("creates projects sequentially and associates task project_ids correctly", async () => {
    const dataset: GoogleTasksDataset = {
      lists: [
        { id: "@default", title: "My Tasks" },
        { id: "list-work", title: "Work Projects" },
      ],
      tasksByListId: {
        "@default": [
          { id: "t-inbox", title: "Inbox item", status: "needsAction" },
        ],
        "list-work": [
          { id: "t-work", title: "Work item", status: "needsAction" },
        ],
      },
    };

    const preview = planGoogleTasksImport(dataset);

    const result = await executeGoogleTasksImport(preview, { isGuest: false });

    expect(result.importedCount).toBe(2);
    expect(result.createdProjectCount).toBe(1); // Only Work Projects, not Inbox

    expect(projectMutations.create).toHaveBeenCalledTimes(1);
    expect(projectMutations.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Work Projects" }),
    );

    // Verify task inputs
    const createManyCalls = vi.mocked(taskMutations.createMany).mock.calls;
    const inboxTaskInput = createManyCalls[0][0][0];
    expect(inboxTaskInput.content).toBe("Inbox item");
    expect(inboxTaskInput.project_id).toBeUndefined();

    const workTaskInput = createManyCalls[1][0][0];
    expect(workTaskInput.content).toBe("Work item");
    expect(workTaskInput.project_id).toBe("proj-work-projects");
  });

  it("creates tasks in chunks of <= 100 items via taskMutations.createMany", async () => {
    const rawTasks = Array.from({ length: 150 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Task Number ${i + 1}`,
      status: "needsAction" as const,
    }));

    const dataset: GoogleTasksDataset = {
      lists: [{ id: "list-big", title: "Big List" }],
      tasksByListId: {
        "list-big": rawTasks,
      },
    };

    const preview = planGoogleTasksImport(dataset);

    const result = await executeGoogleTasksImport(preview, { isGuest: false });

    expect(result.importedCount).toBe(150);

    // 150 tasks should be split into 2 chunks: 100 and 50
    expect(taskMutations.createMany).toHaveBeenCalledTimes(2);
    expect(vi.mocked(taskMutations.createMany).mock.calls[0][0]).toHaveLength(
      100,
    );
    expect(vi.mocked(taskMutations.createMany).mock.calls[1][0]).toHaveLength(
      50,
    );
  });

  it("resolves child subtasks to newly created roots and existing Kagelin roots", async () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-root-id",
          content: "Existing Root",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
      ],
    };

    const dataset: GoogleTasksDataset = {
      lists: [{ id: "list-work", title: "Work" }],
      tasksByListId: {
        "list-work": [
          {
            id: "root-existing",
            title: "Existing Root",
            status: "needsAction",
          }, // skipped duplicate
          {
            id: "sub-redirected",
            title: "New Child of Existing",
            parent: "root-existing",
            status: "needsAction",
          },
          { id: "root-new", title: "New Root Task", status: "needsAction" },
          {
            id: "sub-new",
            title: "Child of New Root",
            parent: "root-new",
            status: "needsAction",
          },
        ],
      },
    };

    const preview = planGoogleTasksImport(dataset, workspace);

    const result = await executeGoogleTasksImport(preview, { isGuest: false });

    expect(result.importedCount).toBe(3); // 1 new root + 2 subtasks

    // Roots created first, then subtasks
    const createManyCalls = vi.mocked(taskMutations.createMany).mock.calls;
    expect(createManyCalls).toHaveLength(2);

    const createdRoots = createManyCalls[0][0];
    expect(createdRoots).toHaveLength(1);
    expect(createdRoots[0].content).toBe("New Root Task");
    const newRootClientId = createdRoots[0]._clientId;

    const createdSubtasks = createManyCalls[1][0];
    expect(createdSubtasks).toHaveLength(2);

    const childOfExisting = createdSubtasks.find(
      (s) => s.content === "New Child of Existing",
    );
    expect(childOfExisting?.parent_id).toBe("existing-root-id");

    const childOfNew = createdSubtasks.find(
      (s) => s.content === "Child of New Root",
    );
    expect(childOfNew?.parent_id).toBe(newRootClientId);
  });

  it("rolls back all created tasks in chunks of <= 100 and created projects on task creation failure", async () => {
    let callCount = 0;
    vi.mocked(taskMutations.createMany).mockImplementation(async (inputs) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Network timeout inserting tasks");
      }
      return inputs.map((input) => ({
        id: input._clientId ?? `t-${Math.random()}`,
        content: input.content,
      })) as never;
    });

    // 150 tasks -> chunk 1 succeeds (100 items), chunk 2 fails (50 items)
    const rawTasks = Array.from({ length: 150 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Task Number ${i + 1}`,
      status: "needsAction" as const,
    }));

    const dataset: GoogleTasksDataset = {
      lists: [{ id: "list-fail", title: "Fail Project" }],
      tasksByListId: {
        "list-fail": rawTasks,
      },
    };

    const preview = planGoogleTasksImport(dataset);

    await expect(
      executeGoogleTasksImport(preview, { isGuest: false }),
    ).rejects.toThrow(GoogleTasksImportFailure);

    // Rollback should delete the 100 created tasks
    expect(taskMutations.deleteMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(taskMutations.deleteMany).mock.calls[0][0]).toHaveLength(
      100,
    );

    // And delete the created project
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-fail-project");
  });

  it("rolls back when user abort signal is triggered", async () => {
    const controller = new AbortController();
    controller.abort();

    const dataset: GoogleTasksDataset = {
      lists: [{ id: "list-1", title: "Project 1" }],
      tasksByListId: {
        "list-1": [{ id: "t1", title: "Task 1", status: "needsAction" }],
      },
    };

    const preview = planGoogleTasksImport(dataset);

    await expect(
      executeGoogleTasksImport(preview, {
        isGuest: false,
        signal: controller.signal,
      }),
    ).rejects.toThrow(GoogleTasksImportFailure);

    expect(taskMutations.createMany).not.toHaveBeenCalled();
  });

  it("rollbackGoogleTasksImport deletes tasks in batches of <= 100", async () => {
    const fakeTaskIds = Array.from(
      { length: 250 },
      (_, i) => `task-id-${i + 1}`,
    );
    const fakeProjectIds = ["proj-1", "proj-2"];

    const success = await rollbackGoogleTasksImport(
      fakeTaskIds,
      fakeProjectIds,
    );

    expect(success).toBe(true);
    // 250 tasks -> 100, 100, 50 (3 calls)
    expect(taskMutations.deleteMany).toHaveBeenCalledTimes(3);
    expect(vi.mocked(taskMutations.deleteMany).mock.calls[0][0]).toHaveLength(
      100,
    );
    expect(vi.mocked(taskMutations.deleteMany).mock.calls[1][0]).toHaveLength(
      100,
    );
    expect(vi.mocked(taskMutations.deleteMany).mock.calls[2][0]).toHaveLength(
      50,
    );

    // Both projects deleted
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-1");
    expect(projectMutations.delete).toHaveBeenCalledWith("proj-2");
  });
});
