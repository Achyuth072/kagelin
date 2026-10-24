import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTodoistImportPlan } from "@/lib/import/todoist/plan";
import { executeTodoistArchiveImport } from "@/lib/import/todoist/importTodoist";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import { persistImportSource } from "@/lib/mutations/importSource";
import { PROJECT_COLORS } from "@/lib/constants/colors";

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: { createMany: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/mutations/project", () => ({
  projectMutations: { create: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/mutations/importSource", () => ({
  persistImportSource: vi.fn().mockResolvedValue(undefined),
}));

const WORK_CSV = `TYPE,CONTENT,PRIORITY,INDENT
meta,view_style=board,,,
task,Ship release,1,1
task,Review PR,4,2
`;

const INBOX_CSV = `TYPE,CONTENT,PRIORITY,INDENT
task,Reply to email,4,1
`;

const EXISTING_CSV = `TYPE,CONTENT,PRIORITY,INDENT
task,Old task,4,1
`;

function csvFile(projectName: string, csvContent: string, isInbox = false) {
  return { fileName: `${projectName}.csv`, projectName, isInbox, csvContent };
}

function existingTask(
  content: string,
  projectId: string | null,
  id = `existing-${content}`,
  parentId: string | null = null,
) {
  return {
    id,
    content,
    project_id: projectId,
    parent_id: parentId,
    is_completed: false,
  };
}

describe("executeTodoistArchiveImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let taskCounter = 0;
    vi.mocked(taskMutations.createMany).mockImplementation(async (inputs) =>
      inputs.map(
        (input) =>
          ({
            id: input._clientId ?? `task-${++taskCounter}`,
            content: input.content,
            project_id: input.project_id ?? null,
            parent_id: input.parent_id ?? null,
          }) as never,
      ),
    );
    vi.mocked(projectMutations.create).mockResolvedValue({
      id: "proj-new",
      name: "Work",
      color: PROJECT_COLORS[0].hex,
      view_style: "board",
      is_inbox: false,
      is_archived: false,
    } as never);
  });

  it("creates new projects, merges matching ones, and routes inbox tasks to the inbox", async () => {
    const plan = buildTodoistImportPlan(
      [
        csvFile("Work", WORK_CSV),
        csvFile("Inbox", INBOX_CSV, true),
        csvFile("Existing", EXISTING_CSV),
      ],
      {
        projects: [{ id: "proj-ex", name: "Existing", is_inbox: false }],
        tasks: [],
      },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    const result = await executeTodoistArchiveImport(plan, {
      isGuest: false,
      fileName: "Todoist-backup.zip",
    });

    expect(result.importedCount).toBe(4);
    expect(result.createdProjectCount).toBe(1);

    expect(projectMutations.create).toHaveBeenCalledTimes(1);
    expect(projectMutations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Work",
        viewStyle: "board",
        color: expect.any(String),
      }),
    );

    const calls = vi
      .mocked(taskMutations.createMany)
      .mock.calls.flatMap(([inputs]) => inputs);
    const ship = calls.find((c) => c.content === "Ship release");
    const review = calls.find((c) => c.content === "Review PR");
    const inbox = calls.find((c) => c.content === "Reply to email");
    const merged = calls.find((c) => c.content === "Old task");

    expect(ship?.project_id).toBe("proj-new");
    expect(review?.parent_id).toBe(ship?._clientId);
    expect(inbox?.project_id).toBeUndefined();
    expect(merged?.project_id).toBe("proj-ex");
  });

  it("attaches the steps of an already existing task to that task", async () => {
    const plan = buildTodoistImportPlan(
      [
        csvFile(
          "Work",
          `TYPE,CONTENT,PRIORITY,INDENT\ntask,Parent,4,1\ntask,Child unique,4,2\n`,
        ),
      ],
      {
        projects: [{ id: "proj-ex", name: "Work", is_inbox: false }],
        tasks: [existingTask("Parent", "proj-ex", "task-existing")],
      },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    const result = await executeTodoistArchiveImport(plan, {
      isGuest: false,
      fileName: "Todoist-backup.zip",
    });

    expect(result.importedCount).toBe(1);

    const calls = vi
      .mocked(taskMutations.createMany)
      .mock.calls.flatMap(([inputs]) => inputs);
    const child = calls.find((c) => c.content === "Child unique");

    expect(child?.project_id).toBe("proj-ex");
    expect(child?.parent_id).toBe("task-existing");
    expect(calls.some((c) => c.content === "Parent")).toBe(false);
  });

  it("attaches a subtask to the root that took over its skipped parent", async () => {
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Parent,4,1
task,Shared,4,2
task,Shared,4,1
task,Child,4,2
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      {
        projects: [{ id: "proj-ex", name: "Work", is_inbox: false }],
        tasks: [existingTask("Other", "proj-ex", "e-other")],
      },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    await executeTodoistArchiveImport(plan, {
      isGuest: false,
      fileName: "Todoist-backup.zip",
    });

    const calls = vi
      .mocked(taskMutations.createMany)
      .mock.calls.flatMap(([inputs]) => inputs);
    const parent = calls.find((c) => c.content === "Parent");
    const child = calls.find((c) => c.content === "Child");

    expect(child?.parent_id).toBe(parent?._clientId);
  });

  it("captures the raw parsed payload for ADR 0006 provenance", async () => {
    const plan = buildTodoistImportPlan(
      [csvFile("Work", WORK_CSV)],
      { projects: [], tasks: [] },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    await executeTodoistArchiveImport(plan, {
      isGuest: true,
      fileName: "Todoist-backup.zip",
    });

    expect(persistImportSource).toHaveBeenCalledWith(
      expect.objectContaining({
        source_app: "todoist",
        file_name: "Todoist-backup.zip",
        raw: expect.objectContaining({ files: expect.any(Array) }),
      }),
      { isGuest: true },
    );
  });

  it("does not create a project for a new plan that ended up with no tasks", async () => {
    const plan = buildTodoistImportPlan(
      [csvFile("Work", WORK_CSV)],
      {
        projects: [{ id: "p-work", name: "Work", is_inbox: false }],
        tasks: [
          existingTask("Ship release", "p-work", "e1"),
          existingTask("Review PR", "p-work", "e2"),
        ],
      },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    const result = await executeTodoistArchiveImport(plan, {
      isGuest: false,
      fileName: "Todoist-backup.zip",
    });

    expect(projectMutations.create).not.toHaveBeenCalled();
    expect(result.importedCount).toBe(0);
  });

  it("reports how much was created when the import fails part-way", async () => {
    vi.mocked(taskMutations.createMany).mockRejectedValueOnce(
      new Error("network down"),
    );

    const plan = buildTodoistImportPlan(
      [csvFile("Work", WORK_CSV)],
      { projects: [], tasks: [] },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    await expect(
      executeTodoistArchiveImport(plan, {
        isGuest: false,
        fileName: "Todoist-backup.zip",
      }),
    ).rejects.toThrow(/network down/);
  });

  it("undoes what it created when the import fails part-way", async () => {
    vi.mocked(taskMutations.createMany)
      .mockResolvedValueOnce([
        { id: "task-1", content: "Ship release" } as never,
      ])
      .mockRejectedValueOnce(new Error("network down"));

    const plan = buildTodoistImportPlan(
      [csvFile("Work", WORK_CSV)],
      { projects: [], tasks: [] },
      new Date("2026-10-14T00:00:00.000Z"),
    );

    await expect(
      executeTodoistArchiveImport(plan, {
        isGuest: false,
        fileName: "Todoist-backup.zip",
      }),
    ).rejects.toThrow(/rolled back/);

    expect(taskMutations.deleteMany).toHaveBeenCalledWith(
      expect.arrayContaining(["task-1"]),
    );
    expect(projectMutations.deleteMany).toHaveBeenCalledWith(["proj-new"]);
  });
});
