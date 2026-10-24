import { describe, it, expect } from "vitest";
import { buildTodoistImportPlan } from "@/lib/import/todoist/plan";
import type { ExistingWorkspace } from "@/lib/import/todoist/types";
import type { TodoistCsvFile } from "@/lib/import/todoist/archive";
import { PROJECT_COLORS } from "@/lib/constants/colors";

const REF_DATE = new Date("2026-10-14T00:00:00.000Z");

function csvFile(
  projectName: string,
  csvContent: string,
  isInbox = false,
): TodoistCsvFile {
  return { fileName: `${projectName}.csv`, projectName, isInbox, csvContent };
}

function existingTask(
  content: string,
  projectId: string | null,
  id = `existing-${content}`,
  parentId: string | null = null,
  isCompleted = false,
) {
  return {
    id,
    content,
    project_id: projectId,
    parent_id: parentId,
    is_completed: isCompleted,
  };
}

const BOARD_CSV = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,DATE
meta,view_style=board,,,,,
task,Ship release,notes,1,1,2026-11-01
task,Review PR,,4,2,
`;

const LIST_CSV = `TYPE,CONTENT,PRIORITY,INDENT
meta,view_style=list,,,
task,Write blog post,4,1
`;

const INBOX_CSV = `TYPE,CONTENT,PRIORITY,INDENT
task,Reply to email,4,1
`;

const EMPTY_WORKSPACE: ExistingWorkspace = { projects: [], tasks: [] };

describe("buildTodoistImportPlan", () => {
  it("routes Inbox.csv to the inbox and creates a new project per other CSV", () => {
    const plan = buildTodoistImportPlan(
      [csvFile("Work", BOARD_CSV), csvFile("Inbox", INBOX_CSV, true)],
      EMPTY_WORKSPACE,
      REF_DATE,
    );

    expect(plan.projects).toHaveLength(2);
    const inbox = plan.projects.find((p) => p.isInbox);
    const work = plan.projects.find((p) => p.name === "Work");

    expect(inbox).toMatchObject({ status: "inbox", isInbox: true });
    expect(work).toMatchObject({
      status: "new",
      viewStyle: "board",
      existingProjectId: null,
    });
    expect(PROJECT_COLORS.map((c) => c.hex)).toContain(work?.color);

    expect(plan.totalTasks).toBe(3);
    expect(plan.rootTasksCount).toBe(2);
    expect(plan.subtasksCount).toBe(1);
    expect(plan.newProjectCount).toBe(1);
    expect(plan.mergedProjectCount).toBe(0);
  });

  it("merges into an existing project whose name matches (case-insensitively)", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "work", is_inbox: false }],
      tasks: [],
    };

    const plan = buildTodoistImportPlan(
      [csvFile("Work", BOARD_CSV)],
      workspace,
      REF_DATE,
    );

    expect(plan.projects[0]).toMatchObject({
      status: "merged",
      existingProjectId: "p-work",
    });
    expect(plan.newProjectCount).toBe(0);
    expect(plan.mergedProjectCount).toBe(1);
  });

  it("skips active tasks whose content already exists in the target project", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [existingTask("Ship release", "p-work")],
    };
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Ship release,4,1
task,New feature,4,1
task,Child of feature,4,2
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      workspace,
      REF_DATE,
    );

    expect(plan.duplicateTasksSkipped).toBe(1);
    expect(plan.totalTasks).toBe(2);
    const contents = plan.projects[0].tasks.map((t) => t.content);
    expect(contents).not.toContain("Ship release");
    expect(contents).toContain("New feature");
  });

  it("does not dedupe against completed tasks", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [existingTask("Ship release", "p-work", "done", null, true)],
    };

    const plan = buildTodoistImportPlan(
      [
        csvFile(
          "Work",
          `TYPE,CONTENT,PRIORITY,INDENT\ntask,Ship release,4,1\n`,
        ),
      ],
      workspace,
      REF_DATE,
    );

    expect(plan.duplicateTasksSkipped).toBe(0);
    expect(plan.totalTasks).toBe(1);
  });

  it("keeps repeated titles in a brand-new project — dedupe is merge-only", () => {
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Buy milk,4,1
task,Buy milk,4,1
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Groceries", csv)],
      EMPTY_WORKSPACE,
      REF_DATE,
    );

    expect(plan.totalTasks).toBe(2);
    expect(plan.duplicateTasksSkipped).toBe(0);
  });

  it("dedupes inbox tasks that were filed under the inbox project id", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "inbox-1", name: "Inbox", is_inbox: true }],
      tasks: [existingTask("Reply to email", "inbox-1")],
    };

    const plan = buildTodoistImportPlan(
      [
        csvFile(
          "Inbox",
          `TYPE,CONTENT,PRIORITY,INDENT\ntask,Reply to email,4,1\ntask,Send invoice,4,1\n`,
          true,
        ),
      ],
      workspace,
      REF_DATE,
    );

    expect(plan.duplicateTasksSkipped).toBe(1);
    expect(plan.totalTasks).toBe(1);
  });

  it("aggregates date range and recurring counts across projects", () => {
    const plan = buildTodoistImportPlan(
      [csvFile("Work", BOARD_CSV), csvFile("Personal", LIST_CSV)],
      EMPTY_WORKSPACE,
      REF_DATE,
    );

    expect(plan.earliestDate).toBe("2026-11-01T00:00:00.000Z");
    expect(plan.latestDate).toBe("2026-11-01T00:00:00.000Z");
    expect(plan.newProjectCount).toBe(2);
  });

  it("keeps the other projects when one file in the backup cannot be parsed", () => {
    const plan = buildTodoistImportPlan(
      [csvFile("Work", BOARD_CSV), csvFile("Notes", "hello,world\n1,2\n")],
      EMPTY_WORKSPACE,
      REF_DATE,
    );

    expect(plan.projects.map((p) => p.name)).toEqual(["Work"]);
    expect(plan.failedFiles).toHaveLength(1);
    expect(plan.failedFiles[0].fileName).toBe("Notes.csv");
    expect(plan.failedFiles[0].message).toMatch(/Missing TYPE or CONTENT/i);
    expect(plan.totalTasks).toBe(2);
  });

  it("re-attaches the steps of a duplicated task to the task that already exists", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [existingTask("Parent", "p-work", "existing-parent")],
    };
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Parent,4,1
task,Child unique,4,2
task,Child unique 2,4,2
task,Other,4,1
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      workspace,
      REF_DATE,
    );

    // The duplicate parent is skipped, but its steps survive.
    expect(plan.duplicateTasksSkipped).toBe(1);
    expect(plan.subtasksReassigned).toBe(2);
    expect(plan.totalTasks).toBe(3);

    const contents = plan.projects[0].tasks.map((t) => t.content);
    expect(contents).not.toContain("Parent");
    expect(contents).toContain("Child unique");
    expect(contents).toContain("Child unique 2");

    const redirected = Object.values(plan.projects[0].parentRedirects);
    expect(redirected).toEqual([
      { kind: "existing", taskId: "existing-parent" },
    ]);
  });

  it("treats a step that shares a title with an existing task as a duplicate", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [existingTask("Shared title", "p-work")],
    };
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Parent,4,1
task,Shared title,4,2
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      workspace,
      REF_DATE,
    );

    expect(plan.duplicateTasksSkipped).toBe(1);
    expect(plan.totalTasks).toBe(1);
  });

  it("dedupes a step against a step that already exists in the project", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [
        existingTask("Parent", "p-work", "existing-parent"),
        existingTask(
          "Existing step",
          "p-work",
          "existing-step",
          "existing-parent",
        ),
      ],
    };
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Parent,4,1
task,Existing step,4,2
task,Fresh step,4,2
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      workspace,
      REF_DATE,
    );

    // The duplicate root and the duplicate step are both skipped; the fresh
    // step survives and is re-attached to the existing parent.
    expect(plan.duplicateTasksSkipped).toBe(2);
    expect(plan.subtasksReassigned).toBe(1);
    const contents = plan.projects[0].tasks.map((t) => t.content);
    expect(contents).toContain("Fresh step");
    expect(contents).not.toContain("Existing step");
  });

  it("hands the subtasks of a root that duplicates a subtask to that subtask's parent", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "p-work", name: "Work", is_inbox: false }],
      tasks: [existingTask("Other", "p-work")],
    };
    const csv = `TYPE,CONTENT,PRIORITY,INDENT
task,Parent,4,1
task,Shared,4,2
task,Shared,4,1
task,Child,4,2
`;

    const plan = buildTodoistImportPlan(
      [csvFile("Work", csv)],
      workspace,
      REF_DATE,
    );

    const project = plan.projects[0];
    expect(project.duplicatesSkipped).toBe(1);
    expect(project.tasks.map((t) => t.content)).toEqual([
      "Parent",
      "Shared",
      "Child",
    ]);
    // The skipped root's subtask is handed to the kept root, so the
    // hierarchy survives.
    expect(project.subtasksReassigned).toBe(1);
    expect(Object.values(project.parentRedirects)).toEqual([
      { kind: "imported", tempId: project.tasks[0].tempId },
    ]);
  });
});
