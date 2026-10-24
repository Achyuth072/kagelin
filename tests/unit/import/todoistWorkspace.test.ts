import { describe, it, expect, beforeEach } from "vitest";
import {
  fetchTodoistImportProjects,
  fetchTodoistImportTasks,
} from "@/lib/import/todoist/workspace";
import { resolveImportTargetProjectIds } from "@/lib/import/todoist/plan";
import { mockStore } from "@/lib/mock/mock-store";
import type { TodoistCsvFile } from "@/lib/import/todoist/archive";

function csvFile(projectName: string, isInbox = false): TodoistCsvFile {
  return {
    fileName: `${projectName}.csv`,
    projectName,
    isInbox,
    csvContent: "TYPE,CONTENT\ntask,Task\n",
  };
}

describe("Todoist import workspace", () => {
  beforeEach(() => {
    mockStore.clearData();
  });

  it("reads back only the projects the backup writes into", () => {
    const work = mockStore.addProject({
      name: "Work",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
    });
    const personal = mockStore.addProject({
      name: "Personal",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
    });

    const ids = resolveImportTargetProjectIds(
      [csvFile("Work"), csvFile("Inbox", true)],
      [
        { id: work.id, name: work.name, is_inbox: work.is_inbox },
        { id: personal.id, name: personal.name, is_inbox: personal.is_inbox },
      ],
    );

    expect(ids).toEqual([work.id]);
  });

  it("skips the tasks of projects the import does not touch", async () => {
    const work = mockStore.addProject({
      name: "Work",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
    });
    const other = mockStore.addProject({
      name: "Other",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
    });

    mockStore.addTask({ content: "In scope", project_id: work.id });
    mockStore.addTask({ content: "Out of scope", project_id: other.id });
    mockStore.addTask({ content: "Inbox task", project_id: null });
    mockStore.addTask({
      content: "Completed",
      project_id: work.id,
      is_completed: true,
    });

    const tasks = await fetchTodoistImportTasks(true, [work.id]);

    expect(tasks.map((task) => task.content).sort()).toEqual([
      "In scope",
      "Inbox task",
    ]);
  });

  it("lists the non-archived projects", async () => {
    mockStore.addProject({
      name: "Active",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
    });
    mockStore.addProject({
      name: "Archived",
      color: "#4B6CB7",
      view_style: "list",
      is_inbox: false,
      is_archived: true,
    });

    const projects = await fetchTodoistImportProjects(true);

    expect(projects.map((project) => project.name)).toEqual(["Active"]);
  });
});
