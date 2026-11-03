import type { Task, Project } from "@/lib/types/task";
import type { CreateTaskInput } from "@/lib/schemas/task";
import type { UseFormReturn, FieldErrors } from "react-hook-form";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import type { GroupOption, SortOption } from "@/lib/types/sorting";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";

export interface TaskGroup {
  title: string;
  tasks: Task[];
}

export interface TaskPresentation {
  groups: TaskGroup[] | null;
  active: Task[];
  evening: Task[];
  completed: Task[];
}

export interface UseTaskDndOptions {
  presentation: TaskPresentation;
  tasks?: Task[];
  projectsMap?: Map<string, Project>;
  groupBy?: GroupOption;
  sortBy?: SortOption;
  isDesktop?: boolean;
}

export interface UseTaskDndReturn {
  activeTask: Task | null;
  activeId: string | null;
  activeWidth: number | null;
  displayPresentation: TaskPresentation;
  isDragging: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  collisionDetection: CollisionDetection;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

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
