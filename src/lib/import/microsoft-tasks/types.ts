import { z } from "zod";

export const MICROSOFT_TASKS_PREVIEW_KIND = "microsoft-tasks" as const;

/**
 * Microsoft Graph To Do Checklist Item (Step) Schema
 */
export const MicrosoftChecklistItemSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isChecked: z.boolean().default(false),
  createdDateTime: z.string().optional(),
  checkedDateTime: z.string().nullable().optional(),
});
export type MicrosoftChecklistItem = z.infer<
  typeof MicrosoftChecklistItemSchema
>;

/**
 * Microsoft Graph Task Body Schema
 */
export const MicrosoftTaskBodySchema = z.object({
  content: z.string().default(""),
  contentType: z.enum(["text", "html"]).default("text"),
});
export type MicrosoftTaskBody = z.infer<typeof MicrosoftTaskBodySchema>;

/**
 * Microsoft Graph DateTimeTimeZone Schema
 */
export const MicrosoftDateTimeTimeZoneSchema = z.object({
  dateTime: z.string(),
  timeZone: z.string().default("UTC"),
});
export type MicrosoftDateTimeTimeZone = z.infer<
  typeof MicrosoftDateTimeTimeZoneSchema
>;

/**
 * Microsoft Graph Task Resource Schema
 */
export const MicrosoftTaskResourceSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled Task"),
  body: MicrosoftTaskBodySchema.optional(),
  importance: z.enum(["low", "normal", "high"]).default("normal"),
  status: z
    .enum([
      "notStarted",
      "inProgress",
      "completed",
      "waitingOnOthers",
      "deferred",
    ])
    .default("notStarted"),
  isReminderOn: z.boolean().default(false),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  completedDateTime: MicrosoftDateTimeTimeZoneSchema.nullable().optional(),
  dueDateTime: MicrosoftDateTimeTimeZoneSchema.nullable().optional(),
  checklistItems: z.array(MicrosoftChecklistItemSchema).default([]),
});
export type MicrosoftTaskResource = z.infer<typeof MicrosoftTaskResourceSchema>;

/**
 * Microsoft Graph Task List Resource Schema
 */
export const MicrosoftTaskListResourceSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isOwner: z.boolean().default(true),
  isShared: z.boolean().default(false),
  wellknownListName: z
    .enum(["none", "defaultList", "flaggedEmails", "unknown"])
    .default("none"),
  tasks: z.array(MicrosoftTaskResourceSchema).default([]),
});
export type MicrosoftTaskListResource = z.infer<
  typeof MicrosoftTaskListResourceSchema
>;

/**
 * Unified In-Memory Microsoft Tasks Dataset
 */
export const MicrosoftTasksDatasetSchema = z.object({
  lists: z.array(MicrosoftTaskListResourceSchema),
  tasksByListId: z.record(z.string(), z.array(MicrosoftTaskResourceSchema)),
});
export type MicrosoftTasksDataset = z.infer<typeof MicrosoftTasksDatasetSchema>;

/**
 * Mapped Microsoft Task matching Kagelin's domain model
 */
export interface MappedMicrosoftTask {
  id: string;
  tempId: string;
  parentId: string | null;
  tempParentId: string | null;
  content: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  priority: 1 | 2 | 3 | 4;
  dayOrder: number;
  listId: string;
}

export type ParentRedirect =
  { kind: "existing"; taskId: string } | { kind: "imported"; tempId: string };

export interface MicrosoftTasksProjectPlan {
  listId: string;
  name: string;
  isInbox: boolean;
  action: "create" | "merge";
  status: "inbox" | "new" | "merged";
  existingProjectId: string | null;
  color: string;
  tasks: MappedMicrosoftTask[];
  duplicatesSkipped: number;
  parentRedirects: Record<string, ParentRedirect>;
  subtasksReassigned: number;
}

export interface MicrosoftTasksImportPreview {
  kind: typeof MICROSOFT_TASKS_PREVIEW_KIND;
  projects: MicrosoftTasksProjectPlan[];
  tasks: MappedMicrosoftTask[];
  totalLists: number;
  totalTasks: number;
  totalCompleted: number;
  duplicatesCount: number;
  rootTasksCount: number;
  subtasksCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  newProjectCount: number;
  mergedProjectCount: number;
  subtasksReassigned: number;
  rawSource?: MicrosoftTasksDataset;
}

export interface ExecuteMicrosoftTasksImportOptions {
  signal?: AbortSignal;
  includeCompleted?: boolean;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  is_inbox: boolean;
}

export interface WorkspaceTask {
  id: string;
  content: string | null;
  project_id: string | null;
  parent_id: string | null;
  is_completed: boolean;
}

export interface ExistingWorkspace {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
}
