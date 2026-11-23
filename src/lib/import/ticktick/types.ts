import { z } from "zod";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

export const TICKTICK_CSV_COLUMNS = [
  "Folder Name",
  "List Name",
  "Title",
  "Tags",
  "Content",
  "Is Check list",
  "Start Date",
  "Due Date",
  "Reminder",
  "Repeat",
  "Priority",
  "Status",
  "Created Time",
  "Completed Time",
  "Order",
  "Timezone",
  "Is All Day",
  "Is Floating",
  "Column Name",
  "Column Order",
  "View Mode",
  "taskId",
  "parentId",
] as const;

export type TickTickCsvColumn = (typeof TICKTICK_CSV_COLUMNS)[number];

export const RawTickTickRowSchema = z.object({
  "Folder Name": z.string().default(""),
  "List Name": z.string().default(""),
  Title: z.string().default(""),
  Tags: z.string().default(""),
  Content: z.string().default(""),
  "Is Check list": z.string().default("0"),
  "Start Date": z.string().default(""),
  "Due Date": z.string().default(""),
  Reminder: z.string().default(""),
  Repeat: z.string().default(""),
  Priority: z.string().default("0"),
  Status: z.string().default("0"),
  "Created Time": z.string().default(""),
  "Completed Time": z.string().default(""),
  Order: z.string().default("0"),
  Timezone: z.string().default(""),
  "Is All Day": z.string().default("0"),
  "Is Floating": z.string().default("0"),
  "Column Name": z.string().default(""),
  "Column Order": z.string().default("0"),
  "View Mode": z.string().default(""),
  taskId: z.string(),
  parentId: z.string().default(""),
});

export type RawTickTickRow = z.infer<typeof RawTickTickRowSchema>;

export interface ExtractedChecklistItem {
  title: string;
  is_completed: boolean;
}

export interface MappedTickTickTask {
  tempId: string;
  tempParentId: string | null;
  originalTaskId: string;
  originalParentId: string | null;
  content: string;
  description: string | null;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  doDate: string | null;
  is_completed: boolean;
  completedAt: string | null;
  recurrence: RecurrenceRule | null;
  listName: string;
  folderName: string | null;
  dayOrder: number;
  originalDepth: number;
}

export interface TickTickProjectPlan {
  name: string;
  folderName: string | null;
  status: "inbox" | "new" | "merged";
  existingProjectId?: string;
  color: string;
  tasks: MappedTickTickTask[];
}

export interface TickTickImportPreview {
  totalTasks: number;
  rootTasksCount: number;
  subtasksCount: number;
  completedTasksCount: number;
  recurringCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  projects: TickTickProjectPlan[];
  parentRedirects: Record<string, string>;
  duplicateTasksSkipped: number;
  subtasksReassigned: number;
}
