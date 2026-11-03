"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/schemas/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { omitUntouchedUnreadable } from "@/lib/crypto/unreadable";
import { UNREADABLE_LABEL } from "@/components/encryption/ReadableText";
import { taskToFormValues, defaultTaskFormValues } from "./task-utils";
import { useTaskEditorDrafts } from "@/lib/store/taskEditorDrafts";
import type {
  UseTaskEditorOptions,
  TaskEditorState,
  TaskFormValues,
} from "@/lib/types/task-view";

function toIsoString(
  date: Date | string | null | undefined,
): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : date;
}

function parseDateValue(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function useTaskEditor({
  task = null,
  open = true,
  onClose,
  autoFocusTitle,
  initialDate,
  initialContent,
}: UseTaskEditorOptions): TaskEditorState {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(CreateTaskSchema),
    mode: "onChange",
    defaultValues: task
      ? taskToFormValues(task)
      : defaultTaskFormValues({
          content: initialContent,
          dueDate: initialDate,
        }),
  });

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    trigger: triggerValidation,
  } = form;

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [doDatePickerOpen, setDoDatePickerOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [pendingStep, setPendingStep] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(false);

  const content = useWatch({ control, name: "content" }) ?? "";
  const watchedDueDate = useWatch({ control, name: "due_date" });
  const dueDate = useMemo(
    () => parseDateValue(watchedDueDate),
    [watchedDueDate],
  );

  const watchedDoDate = useWatch({ control, name: "do_date" });
  const doDate = useMemo(() => parseDateValue(watchedDoDate), [watchedDoDate]);

  const priority = (useWatch({ control, name: "priority" }) ?? 4) as
    1 | 2 | 3 | 4;
  const recurrence = useWatch({
    control,
    name: "recurrence",
  }) as RecurrenceRule | null;
  const selectedProjectId = useWatch({ control, name: "project_id" }) ?? null;
  const description = useWatch({ control, name: "description" }) || "";
  const isEvening = useWatch({ control, name: "is_evening" }) ?? false;

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: inboxProject } = useInboxProject();
  const { data: projects } = useProjects();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { trigger: triggerHaptic } = useHaptic();

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTask, setPrevTask] = useState(task);

  if (open !== prevOpen || task !== prevTask) {
    setPrevOpen(open);
    setPrevTask(task);
    if (open) {
      setDraftSubtasks([]);
      setPendingStep("");
    }
  }

  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });

  // Bridge for view-tier crossings (spec story 20): when the viewport crosses
  // 1280px while inspecting, the docked editor unmounts and TaskSheet mounts a
  // fresh one. Snapshot the live (possibly dirty) form values at unmount so the
  // next editor mount for the same task hydrates from them instead of the
  // task's saved state. Pristine caches are a no-op (values match the task).
  const taskBaselineRef = useRef<{ id: string; json: string } | null>(null);
  useEffect(() => {
    const currentTask = taskRef.current;
    taskBaselineRef.current = currentTask
      ? {
          id: currentTask.id,
          json: JSON.stringify(taskToFormValues(currentTask)),
        }
      : null;
  });

  useEffect(() => {
    return () => {
      const currentTask = taskRef.current;
      const baseline = taskBaselineRef.current;
      if (!currentTask || !baseline || baseline.id !== currentTask.id) return;
      if (JSON.stringify(form.getValues()) === baseline.json) return;
      useTaskEditorDrafts
        .getState()
        .saveDraft(currentTask.id, { ...form.getValues() });
    };
  }, [form]);

  useEffect(() => {
    if (open) {
      if (task) {
        const draft = useTaskEditorDrafts.getState().popDraft(task.id);
        reset(draft ?? taskToFormValues(task));
        void triggerValidation();
      } else {
        reset(
          defaultTaskFormValues({
            content: initialContent,
            dueDate: initialDate,
          }),
        );
      }
    }
  }, [open, task, initialDate, initialContent, reset, triggerValidation]);

  const onFormSubmit = useCallback(
    (data: CreateTaskInput) => {
      triggerHaptic("thud");

      const stepToFlush = pendingStep.trim();

      if (task) {
        updateMutation.mutate(
          omitUntouchedUnreadable(task, {
            ...data,
            id: task.id,
            due_date: toIsoString(data.due_date) ?? null,
            do_date: toIsoString(data.do_date) ?? null,
          }),
        );

        if (stepToFlush) {
          const targetProjectId =
            (data.project_id ?? task.project_id) ||
            inboxProject?.id ||
            undefined;
          createMutation.mutate({
            content: stepToFlush,
            project_id: targetProjectId,
            parent_id: task.id,
            priority: 4,
          });
          setPendingStep("");
        }
      } else {
        const clientId = crypto.randomUUID();
        const createInput = {
          content: data.content,
          description: data.description,
          priority: data.priority,
          due_date: toIsoString(data.due_date),
          do_date: toIsoString(data.do_date),
          is_evening: data.is_evening,
          project_id: data.project_id ?? undefined,
          parent_id: data.parent_id,
          recurrence: recurrence,
          _clientId: clientId,
        };

        createMutation.mutate(createInput);

        const allSubtasks = stepToFlush
          ? [...draftSubtasks, stepToFlush]
          : draftSubtasks;

        if (allSubtasks.length > 0) {
          allSubtasks.forEach((sContent) => {
            createMutation.mutate({
              content: sContent,
              project_id: createInput.project_id || undefined,
              parent_id: clientId,
              priority: 4,
            });
          });
        }
        setDraftSubtasks([]);
        setPendingStep("");
      }
      onClose?.();
    },
    [
      task,
      pendingStep,
      updateMutation,
      inboxProject?.id,
      triggerHaptic,
      createMutation,
      recurrence,
      draftSubtasks,
      onClose,
    ],
  );

  const onSubmit = useCallback(() => {
    void handleSubmit(onFormSubmit)();
  }, [handleSubmit, onFormSubmit]);

  const onDeleteRequest = useCallback(() => {
    if (!task) return;
    setShowDeleteDialog(true);
  }, [task]);

  const onConfirmDelete = useCallback(() => {
    if (!task) return;
    triggerHaptic("thud");
    setShowDeleteDialog(false);
    onClose?.();
    deleteMutation.mutate(task.id);
  }, [task, onClose, deleteMutation, triggerHaptic]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit();
      }
      if (e.key === "Escape") {
        onClose?.();
      }
    },
    [onSubmit, onClose],
  );

  const setContent = useCallback(
    (value: string) => setValue("content", value, { shouldValidate: true }),
    [setValue],
  );
  const setDescription = useCallback(
    (value: string) => setValue("description", value, { shouldValidate: true }),
    [setValue],
  );
  const setDueDate = useCallback(
    (value: Date | undefined) =>
      setValue("due_date", value, { shouldValidate: true }),
    [setValue],
  );
  const setDoDate = useCallback(
    (value: Date | undefined) =>
      setValue("do_date", value, { shouldValidate: true }),
    [setValue],
  );
  const setIsEvening = useCallback(
    (value: boolean) => setValue("is_evening", value, { shouldValidate: true }),
    [setValue],
  );
  const setPriority = useCallback(
    (value: 1 | 2 | 3 | 4) =>
      setValue("priority", value, { shouldValidate: true }),
    [setValue],
  );
  const setRecurrence = useCallback(
    (value: RecurrenceRule | null) =>
      setValue("recurrence", value, { shouldValidate: true }),
    [setValue],
  );
  const setSelectedProjectId = useCallback(
    (value: string | null) =>
      setValue("project_id", value, { shouldValidate: true }),
    [setValue],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const hasContent = form.formState.isValid;

  const deleteTitle = "Delete Task";
  const deleteDescription = `Are you sure you want to delete "${task?.content ?? UNREADABLE_LABEL}"? This action cannot be undone.`;

  return {
    task,
    mode: task ? "edit" : "create",
    form,

    content,
    setContent,
    description,
    setDescription,
    dueDate,
    setDueDate,
    doDate,
    setDoDate,
    isEvening,
    setIsEvening,
    priority,
    setPriority,
    recurrence,
    setRecurrence,
    selectedProjectId,
    setSelectedProjectId,

    datePickerOpen,
    setDatePickerOpen,
    doDatePickerOpen,
    setDoDatePickerOpen,
    showSubtasks,
    setShowSubtasks,
    draftSubtasks,
    setDraftSubtasks,
    pendingStep,
    setPendingStep,

    inboxProjectId: inboxProject?.id || null,
    projects,
    isMobile,
    autoFocusTitle: autoFocusTitle ?? true,

    isPending,
    hasContent,
    errors: form.formState.errors,

    onSubmit,
    onKeyDown,

    showDeleteDialog,
    setShowDeleteDialog,
    onDeleteRequest,
    onConfirmDelete,
    deleteTitle,
    deleteDescription,
  };
}
