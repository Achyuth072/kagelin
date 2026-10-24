import { zipSync, strToU8 } from "fflate";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task, Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

export const TODOIST_CSV_COLUMNS = [
  "TYPE",
  "CONTENT",
  "DESCRIPTION",
  "PRIORITY",
  "INDENT",
  "AUTHOR",
  "RESPONSIBLE",
  "DATE",
  "DATE_LANG",
  "TIMEZONE",
  "DURATION",
  "DURATION_UNIT",
  "DEADLINE",
  "DEADLINE_LANG",
] as const;

export type TodoistCsvColumn = (typeof TODOIST_CSV_COLUMNS)[number];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function escapeCsvField(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvRow(
  fields: (string | number | boolean | null | undefined)[],
): string {
  return fields.map(escapeCsvField).join(",");
}

export function formatTodoistDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  if (dateStr instanceof Date) return format(dateStr, "yyyy-MM-dd");

  const trimmed = dateStr.trim();
  // Timed ISO strings must resolve to the local date; the UTC date part can differ by a day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? trimmed : format(parsed, "yyyy-MM-dd");
}

export function formatTodoistRecurrence(rule: RecurrenceRule): string {
  const { freq, interval = 1, days } = rule;

  switch (freq) {
    case "DAILY":
      return interval > 1 ? `every ${interval} days` : "every day";

    case "WEEKLY": {
      if (days && days.length > 0) {
        const sortedDays = [...new Set(days)]
          .filter((d) => d >= 0 && d <= 6)
          .sort((a, b) => a - b);
        if (sortedDays.length > 0) {
          const dayList = sortedDays.map((d) => DAY_NAMES[d]).join(", ");
          return `every ${dayList}`;
        }
      }
      return interval > 1 ? `every ${interval} weeks` : "every week";
    }

    case "MONTHLY":
      return interval > 1 ? `every ${interval} months` : "every month";

    case "YEARLY":
      return interval > 1 ? `every ${interval} years` : "every year";

    default:
      return "every day";
  }
}

export function mapTaskDates(
  task: Pick<Task, "do_date" | "due_date" | "recurrence">,
): {
  date: string;
  dateLang: string;
  deadline: string;
  deadlineLang: string;
} {
  let date = "";
  let deadline = "";

  if (task.recurrence) {
    date = formatTodoistRecurrence(task.recurrence);
    deadline = task.due_date ? formatTodoistDate(task.due_date) : "";
  } else if (task.do_date && task.due_date) {
    date = formatTodoistDate(task.do_date);
    deadline = formatTodoistDate(task.due_date);
  } else if (task.do_date || task.due_date) {
    date = formatTodoistDate(task.do_date ?? task.due_date);
  }

  return {
    date,
    dateLang: date ? "en" : "",
    deadline,
    deadlineLang: deadline ? "en" : "",
  };
}

export function formatTodoistProjectCsv(options: {
  project?: Partial<Project> | null;
  tasks: Task[];
}): string {
  const { tasks } = options;

  const lines: string[] = [
    TODOIST_CSV_COLUMNS.join(","),
    formatCsvRow(["meta", "view_style=list", ...Array(12).fill("")]),
    formatCsvRow(Array(14).fill("")),
  ];

  const activeTasks = tasks.filter((t) => !t.is_completed);
  const rootIds = new Set(
    activeTasks.filter((t) => !t.parent_id).map((t) => t.id),
  );
  const rootTasks: Task[] = [];
  const childrenByParent = new Map<string, Task[]>();

  for (const task of activeTasks) {
    // Children of non-root parents can't be emitted at INDENT 2, so promote to roots.
    if (task.parent_id && rootIds.has(task.parent_id)) {
      const list = childrenByParent.get(task.parent_id) ?? [];
      list.push(task);
      childrenByParent.set(task.parent_id, list);
    } else {
      rootTasks.push(task);
    }
  }

  const sortTasks = (a: Task, b: Task) => {
    if (a.day_order !== b.day_order) return a.day_order - b.day_order;
    return a.created_at.localeCompare(b.created_at);
  };

  rootTasks.sort(sortTasks);
  for (const children of childrenByParent.values()) {
    children.sort(sortTasks);
  }

  const emitTask = (task: Task, indent: 1 | 2) => {
    const { date, dateLang, deadline, deadlineLang } = mapTaskDates(task);
    lines.push(
      formatCsvRow([
        "task",
        task.content ?? "",
        task.description ?? "",
        task.priority ?? 4,
        indent,
        "",
        "",
        date,
        dateLang,
        "",
        "",
        "",
        deadline,
        deadlineLang,
      ]),
    );
  };

  for (const root of rootTasks) {
    emitTask(root, 1);
    const children = childrenByParent.get(root.id) ?? [];
    for (const child of children) {
      emitTask(child, 2);
    }
  }

  return lines.join("\n") + "\n";
}

export function sanitizeProjectFileName(name: string): string {
  const sanitized = name
    .replace(/[/\\:*?"<>|]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  return sanitized.length > 0 ? sanitized : "Project";
}

export function generateTodoistExportFilename(date?: Date | string): string {
  const dateStr = !date
    ? format(new Date(), "yyyy-MM-dd")
    : typeof date === "string"
      ? date.split("T")[0]
      : format(date, "yyyy-MM-dd");
  return `Todoist Export ${dateStr}.zip`;
}

export const generateTodoistZipFilename = generateTodoistExportFilename;

export interface TodoistExportData {
  tasks: Task[];
  projects: Project[];
}

export interface TodoistExportOptions {
  isGuest?: boolean;
  supabase?: SupabaseClient;
}

export function buildTodoistExportZip(data: TodoistExportData): Uint8Array {
  const { tasks, projects } = data;

  const activeProjects = projects.filter((p) => !p.is_archived);
  const inboxProject = activeProjects.find((p) => p.is_inbox);
  const customProjects = activeProjects.filter((p) => !p.is_inbox);

  const customProjectIds = new Set(customProjects.map((p) => p.id));

  const inboxTasks: Task[] = [];
  const tasksByProjectId = new Map<string, Task[]>();

  for (const task of tasks) {
    if (task.is_completed) continue;

    if (
      !task.project_id ||
      (inboxProject && task.project_id === inboxProject.id)
    ) {
      inboxTasks.push(task);
    } else if (customProjectIds.has(task.project_id)) {
      const list = tasksByProjectId.get(task.project_id) ?? [];
      list.push(task);
      tasksByProjectId.set(task.project_id, list);
    }
  }

  const files: Record<string, Uint8Array> = {};

  const inboxCsv = formatTodoistProjectCsv({
    project: inboxProject ?? {
      name: "Inbox",
      view_style: "list",
      is_inbox: true,
    },
    tasks: inboxTasks,
  });
  files["Inbox.csv"] = strToU8(inboxCsv);

  const usedLowerNames = new Set<string>(["inbox.csv"]);

  for (const project of customProjects) {
    const baseName = sanitizeProjectFileName(project.name ?? "Project");
    let fileName = `${baseName}.csv`;
    let counter = 2;

    while (usedLowerNames.has(fileName.toLowerCase())) {
      fileName = `${baseName} (${counter}).csv`;
      counter++;
    }

    usedLowerNames.add(fileName.toLowerCase());

    const projectTasks = tasksByProjectId.get(project.id) ?? [];
    const projectCsv = formatTodoistProjectCsv({
      project,
      tasks: projectTasks,
    });

    files[fileName] = strToU8(projectCsv);
  }

  return zipSync(files, { level: 6 });
}

export async function collectTodoistExportData(
  options: TodoistExportOptions = {},
): Promise<TodoistExportData> {
  const isGuest =
    options.isGuest ??
    (typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true");

  if (isGuest) {
    const tasks = mockStore.getTasks();
    const projects = mockStore.getProjects();
    return { tasks, projects };
  }

  const supabase = options.supabase ?? createClient();

  const [projects, tasks] = await Promise.all([
    fetchAllRows<Project>((from, to) =>
      supabase
        .from("projects")
        .select("*")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<Task>((from, to) =>
      supabase
        .from("tasks")
        .select("*")
        .eq("is_completed", false)
        .order("day_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  return { tasks, projects };
}

export async function exportToTodoistZip(
  options: TodoistExportOptions = {},
): Promise<Uint8Array> {
  return buildTodoistExportZip(await collectTodoistExportData(options));
}
