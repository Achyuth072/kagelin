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
