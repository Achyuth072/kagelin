"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

import type { Task } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import { TaskView } from "./TaskView";
import { TaskInsightsPanel } from "./TaskInsightsPanel";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { SheetTabToggle, type SheetTab } from "@/components/ui/SheetTabToggle";
import { cn } from "@/lib/utils";

interface TaskSheetProps {
  open: boolean;
  onClose: () => void;
  initialTask?: Task | null;
  initialDate?: Date | null;
  initialContent?: string;
  initialTab?: SheetTab;
}

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/schemas/task";

export default function TaskSheet({
  open,
  onClose,
  initialTask,
  initialDate,
  initialContent,
  initialTab,
}: TaskSheetProps) {
  // Use the preserved task for rendering during close animation
  const [preservedTask, setPreservedTask] = useState<Task | null | undefined>(
    initialTask,
  );

  if (open && initialTask !== preservedTask) {
    setPreservedTask(initialTask);
  }

  const effectiveTask = open ? initialTask : preservedTask;

  // React Hook Form
  type TaskFormValues = CreateTaskInput & {
    recurrence?: RecurrenceRule | null;
  };

  const {
    handleSubmit,
    setValue,
    control,
    reset,
    trigger: triggerValidation,
    formState: { errors, isValid },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(CreateTaskSchema),
    mode: "onChange",
    defaultValues: {
      content: "",
      description: "",
      priority: 4,
      is_evening: false,
    },
  });

  // Individual UI-only states (not part of task data structure itself)
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [doDatePickerOpen, setDoDatePickerOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [tab, setTab] = useState<SheetTab>("edit");

  // Form values via useWatch
  const content = useWatch({ control, name: "content" });
  const watchedDueDate = useWatch({ control, name: "due_date" });
  const dueDate = useMemo(
    () => (watchedDueDate ? new Date(watchedDueDate as string) : undefined),
    [watchedDueDate],
  );

  const watchedDoDate = useWatch({ control, name: "do_date" });
  const doDate = useMemo(
    () => (watchedDoDate ? new Date(watchedDoDate as string) : undefined),
    [watchedDoDate],
  );

  const priority = (useWatch({ control, name: "priority" }) ?? 4) as
    | 1
    | 2
    | 3
    | 4;
  const recurrence = useWatch({
    control,
    name: "recurrence",
  }) as RecurrenceRule | null;
  const selectedProjectId = useWatch({ control, name: "project_id" }) ?? null;
  const description = useWatch({ control, name: "description" }) || "";

  // Hooks
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: inboxProject } = useInboxProject();
  const { data: projects } = useProjects();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { trigger: triggerHaptic } = useHaptic();

  // Reset UI-only states during render when dialog opens or task changes
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTask, setPrevTask] = useState(initialTask);

  const hasSeries = !!initialTask?.recurring_series_id;

  if (open !== prevOpen || initialTask !== prevTask) {
    setPrevOpen(open);
    setPrevTask(initialTask);
    if (open) {
      setDraftSubtasks([]);
      setIsPreviewMode(!!initialTask?.description);
      setTab(initialTab === "insights" && hasSeries ? "insights" : "edit");
    }
  }

  // Reset form when dialog opens (form reset remains in effect as it's a complex side effect)
  useEffect(() => {
    if (open) {
      if (initialTask) {
        reset({
          content: initialTask.content,
          description: initialTask.description || "",
          due_date: initialTask.due_date ?? undefined,
          do_date: initialTask.do_date ?? undefined,
          is_evening: initialTask.is_evening || false,
          priority: initialTask.priority,
          project_id: initialTask.project_id ?? undefined,
        });
        void triggerValidation();
      } else {
        reset({
          content: initialContent || "",
          description: "",
          due_date: initialDate?.toISOString() ?? undefined,
          do_date: undefined,
          is_evening: false,
          priority: 4,
          project_id: undefined,
        });
      }
    }
  }, [
    open,
    initialTask,
    initialDate,
    initialContent,
    reset,
    triggerValidation,
  ]);

  // Handlers
  const onFormSubmit = useCallback(
    (data: CreateTaskInput) => {
      triggerHaptic("thud");

      if (initialTask) {
        updateMutation.mutate({
          ...data,
          id: initialTask.id,
          due_date:
            data.due_date instanceof Date
              ? data.due_date.toISOString()
              : data.due_date || null,
          do_date:
            data.do_date instanceof Date
              ? data.do_date.toISOString()
              : data.do_date || null,
        });
      } else {
        const clientId = crypto.randomUUID();
        const createInput = {
          content: data.content,
          description: data.description,
          priority: data.priority,
          due_date:
            (data.due_date instanceof Date
              ? data.due_date.toISOString()
              : data.due_date) ?? undefined,
          do_date:
            (data.do_date instanceof Date
              ? data.do_date.toISOString()
              : data.do_date) ?? undefined,
          is_evening: data.is_evening,
          project_id: data.project_id ?? undefined,
          parent_id: data.parent_id,
          recurrence: recurrence,
          _clientId: clientId,
        };

        createMutation.mutate(createInput);

        if (draftSubtasks.length > 0) {
          draftSubtasks.forEach((sContent) => {
            createMutation.mutate({
              content: sContent,
              project_id: createInput.project_id || undefined,
              parent_id: clientId,
              priority: 4,
            });
          });
        }
        setDraftSubtasks([]);
      }
      onClose();
    },
    [
      initialTask,
      updateMutation,
      triggerHaptic,
      createMutation,
      recurrence,
      draftSubtasks,
      onClose,
    ],
  );

  const handleDelete = useCallback(() => {
    if (!initialTask) return;
    setShowDeleteDialog(true);
  }, [initialTask]);

  const handleConfirmDelete = useCallback(() => {
    if (!initialTask) return;
    setShowDeleteDialog(false);
    onClose();
    deleteMutation.mutate(initialTask.id);
  }, [initialTask, onClose, deleteMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit(onFormSubmit)();
      }
    },
    [handleSubmit, onFormSubmit],
  );

  // Derived State
  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreationMode = !effectiveTask;

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent
        className={cn(
          "w-full gap-0 rounded-lg p-0 overflow-hidden outline-none",
          tab === "insights" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex flex-col max-h-[90dvh] min-w-0">
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>
              {initialTask ? "Edit Task" : "New Task"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {initialTask
                ? "Update existing task details"
                : "Create a new task with content and metadata"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {!isCreationMode && hasSeries && (
            <div className="px-4 pt-3 pb-1 shrink-0">
              <SheetTabToggle value={tab} onValueChange={setTab} />
            </div>
          )}

          <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
            {tab === "insights" && hasSeries ? (
              <TaskInsightsPanel task={effectiveTask!} />
            ) : isCreationMode ? (
              <TaskView
                mode="create"
                content={content}
                setContent={(v) =>
                  setValue("content", v, { shouldValidate: true })
                }
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                isPreviewMode={isPreviewMode}
                setIsPreviewMode={setIsPreviewMode}
                dueDate={dueDate}
                setDueDate={(v) =>
                  setValue("due_date", v, { shouldValidate: true })
                }
                doDate={doDate}
                setDoDate={(v) =>
                  setValue("do_date", v, { shouldValidate: true })
                }
                setIsEvening={(v) =>
                  setValue("is_evening", v, { shouldValidate: true })
                }
                priority={priority}
                setPriority={(v) =>
                  setValue("priority", v, { shouldValidate: true })
                }
                recurrence={recurrence}
                setRecurrence={(v) =>
                  setValue("recurrence", v, { shouldValidate: true })
                }
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={(v) =>
                  setValue("project_id", v, { shouldValidate: true })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
                doDatePickerOpen={doDatePickerOpen}
                setDoDatePickerOpen={setDoDatePickerOpen}
                showSubtasks={showSubtasks}
                setShowSubtasks={setShowSubtasks}
                draftSubtasks={draftSubtasks}
                setDraftSubtasks={setDraftSubtasks}
                inboxProjectId={inboxProject?.id || null}
                projects={projects}
                isMobile={isMobile}
                hasContent={isValid}
                isPending={isPending}
                onSubmit={handleSubmit(onFormSubmit)}
                onKeyDown={handleKeyDown}
                errors={errors}
              />
            ) : (
              <TaskView
                mode="edit"
                initialTask={effectiveTask!}
                content={content}
                setContent={(v) =>
                  setValue("content", v, { shouldValidate: true })
                }
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                isPreviewMode={isPreviewMode}
                setIsPreviewMode={setIsPreviewMode}
                dueDate={dueDate}
                setDueDate={(v) =>
                  setValue("due_date", v, { shouldValidate: true })
                }
                doDate={doDate}
                setDoDate={(v) =>
                  setValue("do_date", v, { shouldValidate: true })
                }
                setIsEvening={(v) =>
                  setValue("is_evening", v, { shouldValidate: true })
                }
                priority={priority}
                setPriority={(v) =>
                  setValue("priority", v, { shouldValidate: true })
                }
                recurrence={recurrence}
                setRecurrence={(v) =>
                  setValue("recurrence", v, { shouldValidate: true })
                }
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={(v) =>
                  setValue("project_id", v, { shouldValidate: true })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
                doDatePickerOpen={doDatePickerOpen}
                setDoDatePickerOpen={setDoDatePickerOpen}
                showSubtasks={showSubtasks}
                setShowSubtasks={setShowSubtasks}
                draftSubtasks={draftSubtasks}
                setDraftSubtasks={setDraftSubtasks}
                inboxProjectId={inboxProject?.id || null}
                projects={projects}
                isMobile={isMobile}
                hasContent={isValid}
                isPending={isPending}
                onSubmit={handleSubmit(onFormSubmit)}
                onDelete={handleDelete}
                onKeyDown={handleKeyDown}
                errors={errors}
              />
            )}
          </div>
        </div>
      </ResponsiveDialogContent>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        description={`Are you sure you want to delete "${effectiveTask?.content}"? This action cannot be undone.`}
      />
    </ResponsiveDialog>
  );
}
