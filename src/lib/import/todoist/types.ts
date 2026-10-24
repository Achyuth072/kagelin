import type { Project, Task } from "@/lib/types/task";

export type TodoistRowType = "task" | "section" | "note" | "meta";

export interface TodoistRow {
  type: TodoistRowType;
  content: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4;
  indent: number;
  author?: string;
  responsible?: string;
  date?: string;
  dateLang?: string;
  timezone?: string;
  duration?: number;
  durationUnit?: string;
  deadline?: string;
  deadlineLang?: string;
  isCollapsed?: boolean;
}

export interface ParseTodoistResult {
  rows: TodoistRow[];
  meta: {
    viewStyle?: "list" | "board";
    projectName?: string;
  };
}

export const TODOIST_CSV_PREVIEW_KIND = "todoist-csv" as const;
export const TODOIST_ARCHIVE_PREVIEW_KIND = "todoist-archive" as const;

export type WorkspaceProject = Pick<Project, "id" | "name" | "is_inbox">;
export type WorkspaceTask = Pick<
  Task,
  "id" | "content" | "project_id" | "parent_id" | "is_completed"
>;

export interface ExistingWorkspace {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
}
