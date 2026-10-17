import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  prepareTodoistImport,
  executeTodoistImport,
} from "@/lib/import/todoist/importTodoist";
import { taskMutations } from "@/lib/mutations/task";
import { persistImportSource } from "@/lib/mutations/importSource";

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/mutations/importSource", () => ({
  persistImportSource: vi.fn().mockResolvedValue(undefined),
}));

describe("Todoist Import Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleCsv = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
meta,view_style=list,,,,,,,,,,,,
task,Project Kickoff,,1,1,,,2026-10-20,en,,,,,
task,Draft architecture spec,,4,2,,,2026-10-22,en,,,,,
task,Review with team,,4,2,,,,,,,,,,
task,Recurring sync,,2,1,,,every week,en,,,,,
`;

  it("prepares import preview with task counts and scheduled date range", () => {
    const preview = prepareTodoistImport(sampleCsv, {
      refDate: new Date("2026-10-14T00:00:00.000Z"),
    });

    // 4 tasks total: Kickoff, Promoted Draft spec (has date), Review with team (subtask), Recurring sync
    expect(preview.totalTasks).toBe(4);
    expect(preview.recurringCount).toBe(1);
    expect(preview.earliestDate).toBeDefined();
    expect(preview.latestDate).toBeDefined();
  });

  it("executes import creating top-level tasks first and attaching subtasks with resolved parent_ids", async () => {
    const preview = prepareTodoistImport(sampleCsv, {
      refDate: new Date("2026-10-14T00:00:00.000Z"),
    });

    let mockIdCounter = 1;
    vi.mocked(taskMutations.create).mockImplementation(async (input) => ({
      id: `task-id-${mockIdCounter++}`,
      user_id: "test-user",
      project_id: input.project_id ?? null,
      parent_id: input.parent_id ?? null,
      content: input.content,
      description: input.description ?? null,
      priority: input.priority ?? 4,
      due_date: input.due_date ?? null,
      do_date: input.do_date ?? null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: input.recurrence ?? null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const result = await executeTodoistImport(preview, {
      projectId: "project-123",
      fileName: "Work.csv",
    });

    expect(result.importedCount).toBe(4);
    expect(persistImportSource).toHaveBeenCalledWith(
      expect.objectContaining({
        source_app: "todoist",
        file_name: "Work.csv",
      }),
      expect.anything(),
    );

    // Verify taskMutations.create was called 4 times
    expect(taskMutations.create).toHaveBeenCalledTimes(4);

    // Verify subtask had its parent_id set to the parent task's id
    const calls = vi.mocked(taskMutations.create).mock.calls;
    const parentCall = calls.find(([arg]) => arg.content === "Project Kickoff");
    const subtaskCall = calls.find(
      ([arg]) => arg.content === "Review with team",
    );

    expect(parentCall).toBeDefined();
    expect(subtaskCall).toBeDefined();
    expect(subtaskCall?.[0].parent_id).toBe("task-id-1");
  });
});
