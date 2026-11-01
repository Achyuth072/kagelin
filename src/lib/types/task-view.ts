import type { Task, Project } from "@/lib/types/task";
import type { CreateTaskInput } from "@/lib/schemas/task";
import type { UseFormReturn, FieldErrors } from "react-hook-form";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

export type TaskFormValues = CreateTaskInput;

export interface UseTaskEditorOptions {
  task?: Task | null;
  open?: boolean;
  onClose?: () => void;
  autoFocusTitle?: boolean;
  initialDate?: Date | null;
  initialContent?: string;
}

export interface TaskEditorState {
  task: Task | null;
  mode: "create" | "edit";
  form: UseFormReturn<TaskFormValues>;

  content: string;
  setContent: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  dueDate: Date | undefined;
  setDueDate: (value: Date | undefined) => void;
  doDate: Date | undefined;
  setDoDate: (value: Date | undefined) => void;
  isEvening: boolean;
  setIsEvening: (value: boolean) => void;
  priority: 1 | 2 | 3 | 4;
  setPriority: (value: 1 | 2 | 3 | 4) => void;
  recurrence: RecurrenceRule | null;
  setRecurrence: (value: RecurrenceRule | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (value: string | null) => void;

  datePickerOpen: boolean;
  setDatePickerOpen: (open: boolean) => void;
  doDatePickerOpen: boolean;
  setDoDatePickerOpen: (open: boolean) => void;
  showSubtasks: boolean;
  setShowSubtasks: (open: boolean) => void;
  draftSubtasks: string[];
  setDraftSubtasks: (tasks: string[]) => void;
  pendingStep: string;
  setPendingStep: (step: string) => void;

  inboxProjectId: string | null;
  projects: Project[] | undefined;
  isMobile: boolean;
  autoFocusTitle: boolean;

  isPending: boolean;
  hasContent: boolean;
  errors: FieldErrors<TaskFormValues>;

  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;

  showDeleteDialog: boolean;
  setShowDeleteDialog: (open: boolean) => void;
  onDeleteRequest: () => void;
  onConfirmDelete: () => void;
  deleteTitle: string;
  deleteDescription: string;
}
