import { describe, it, expect } from "vitest";
import { buildTodoistImportPlan } from "@/lib/import/todoist/plan";
import type { ExistingWorkspace } from "@/lib/import/todoist/plan";
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
      tasks: [
        { content: "Ship release", project_id: "p-work", is_completed: false },
      ],
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
      tasks: [
        { content: "Ship release", project_id: "p-work", is_completed: true },
      ],
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
      tasks: [
        {
          content: "Reply to email",
          project_id: "inbox-1",
          is_completed: false,
        },
      ],
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
});
