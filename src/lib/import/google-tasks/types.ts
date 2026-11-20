import { z } from "zod";

export const GOOGLE_TASKS_PREVIEW_KIND = "google-tasks" as const;

/**
 * Google Task List Resource Schema (REST API & normalized dataset)
 */
export const GoogleTaskListResourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    updated: z.string().optional(),
  })
  .strict();

export type GoogleTaskListResource = z.infer<
  typeof GoogleTaskListResourceSchema
>;

/**
 * Google Task Resource Schema (REST API & normalized dataset)
 */
export const GoogleTaskResourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    notes: z.string().optional(),
    due: z.string().optional(),
    status: z.enum(["needsAction", "completed"]),
    completed: z.string().optional(),
    parent: z.string().optional(),
    position: z.string().optional(),
    deleted: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .strict();

export type GoogleTaskResource = z.infer<typeof GoogleTaskResourceSchema>;

/**
 * Unified Google Tasks In-Memory Dataset
 */
export const GoogleTasksDatasetSchema = z
  .object({
    lists: z.array(GoogleTaskListResourceSchema),
    tasksByListId: z.record(z.string(), z.array(GoogleTaskResourceSchema)),
  })
  .strict();

export type GoogleTasksDataset = z.infer<typeof GoogleTasksDatasetSchema>;

/**
 * Google Takeout Tasks.json item schema
 */
export const GoogleTakeoutItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  due: z.string().optional(),
  status: z.string().optional(),
  completed: z.string().optional(),
  parent: z.string().optional(),
  position: z.string().optional(),
  deleted: z.boolean().optional(),
});

export type GoogleTakeoutItem = z.infer<typeof GoogleTakeoutItemSchema>;

/**
 * Google Takeout Tasks.json list schema
 */
export const GoogleTakeoutListSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  items: z.array(GoogleTakeoutItemSchema).optional(),
});

export type GoogleTakeoutList = z.infer<typeof GoogleTakeoutListSchema>;

/**
 * Google Takeout Tasks.json root schema
 */
export const GoogleTakeoutExportSchema = z.object({
  kind: z.string().optional(),
  items: z.array(GoogleTakeoutListSchema).optional(),
});

export type GoogleTakeoutExport = z.infer<typeof GoogleTakeoutExportSchema>;

/**
 * Kagelin Mapped Google Task Schema
 */
export const MappedGoogleTaskSchema = z.object({
  id: z.string(),
  tempId: z.string(),
  parentId: z.string().nullable(),
  tempParentId: z.string().nullable(),
  content: z.string(),
  description: z.string().nullable(),
  dueDate: z.string().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable(),
  dayOrder: z.number().int().nonnegative(),
  listId: z.string(),
  originalDepth: z.number().int().nonnegative(),
});

export type MappedGoogleTask = z.infer<typeof MappedGoogleTaskSchema>;

/**
 * Subtask parent replacement redirect
 */
export type ParentRedirect =
  { kind: "existing"; taskId: string } | { kind: "imported"; tempId: string };

/**
 * Planned Google Tasks Project Mapping
 */
export interface GoogleTasksProjectPlan {
  listId: string;
  name: string;
  isInbox: boolean;
  status: "inbox" | "new" | "merged";
  color: string;
  existingProjectId: string | null;
  tasks: MappedGoogleTask[];
  duplicatesSkipped: number;
  parentRedirects: Record<string, ParentRedirect>;
  subtasksReassigned: number;
}

/**
 * Pre-commit import preview
 */
export interface GoogleTasksImportPreview {
  kind: typeof GOOGLE_TASKS_PREVIEW_KIND;
  projects: GoogleTasksProjectPlan[];
  totalTasks: number;
  rootTasksCount: number;
  subtasksCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  newProjectCount: number;
  mergedProjectCount: number;
  duplicateTasksSkipped: number;
  subtasksReassigned: number;
}
