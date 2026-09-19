"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
} from "@/lib/hooks/useHabitMutations";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateHabitSchema, type CreateHabitInput } from "@/lib/schemas/habit";
import { REMINDER_EVERY_DAY, type Habit } from "@/lib/types/habit";
import { HabitView } from "./HabitView";
import { HabitInsightsPanel } from "./HabitInsightsPanel";
import { SheetTabToggle, type SheetTab } from "@/components/ui/SheetTabToggle";
import { cn } from "@/lib/utils";

interface HabitSheetProps {
  open: boolean;
  onClose: () => void;
  initialHabit?: Habit | null;
  initialTab?: SheetTab;
}

export function HabitSheet({
  open,
  onClose,
  initialHabit,
  initialTab,
}: HabitSheetProps) {
  // Prevent flicker between create/edit modes during dialog close animation.
  const [preservedHabit, setPreservedHabit] = useState<
    Habit | null | undefined
  >(initialHabit);

  if (open && initialHabit !== preservedHabit) {
    setPreservedHabit(initialHabit);
  }

  const effectiveHabit = open ? initialHabit : preservedHabit;

  // Reset tab on every open transition so reopening via "View stats" lands on Insights.
  const [tab, setTab] = useState<SheetTab>(() =>
    open && initialHabit ? (initialTab ?? "edit") : "edit",
  );
  const [prevOpenForTab, setPrevOpenForTab] = useState(open);
  if (open !== prevOpenForTab) {
    setPrevOpenForTab(open);
    if (open) {
      setTab(initialHabit ? (initialTab ?? "edit") : "edit");
    }
  }

  const {
    handleSubmit,
    setValue,
    control,
    reset,
    trigger: triggerValidation,
    formState: { errors, isValid },
  } = useForm<CreateHabitInput>({
    resolver: zodResolver(CreateHabitSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      color: "#4B6CB7",
      icon: "Flame",
      habit_type: "boolean",
      frequency_count: 1,
      frequency_period: "day",
      target_type: "at_least",
      target_value: undefined,
      unit: "",
      question: "",
      reminder_time: null,
      reminder_days: REMINDER_EVERY_DAY,
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const name = useWatch({ control, name: "name" });
  const description = useWatch({ control, name: "description" }) || "";
  const color = useWatch({ control, name: "color" }) || "#4B6CB7";
  const icon = useWatch({ control, name: "icon" }) || "Flame";
  const startDate = useWatch({ control, name: "start_date" });
  const habitType = useWatch({ control, name: "habit_type" }) ?? "boolean";
  const frequencyCount = useWatch({ control, name: "frequency_count" }) ?? 1;
  const frequencyPeriod =
    useWatch({ control, name: "frequency_period" }) ?? "day";
  const targetValue = useWatch({ control, name: "target_value" });
  const targetType = useWatch({ control, name: "target_type" }) ?? "at_least";
  const unit = useWatch({ control, name: "unit" }) || "";
  const question = useWatch({ control, name: "question" }) || "";
  const reminderTime = useWatch({ control, name: "reminder_time" });
  const reminderDays =
    useWatch({ control, name: "reminder_days" }) ?? REMINDER_EVERY_DAY;

  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit();
  const deleteMutation = useDeleteHabit();
  const isMobile = useMediaQuery("(max-width: 768px)");
  // Matches ResponsiveDialog breakpoint; desktop CSS grid requires explicit max-height.
  const isDrawer = useMediaQuery("(max-width: 640px)");
  const { trigger: triggerHaptic } = useHaptic();

  useEffect(() => {
    if (open) {
      if (initialHabit) {
        reset({
          name: initialHabit.name,
          description: initialHabit.description || "",
          color: initialHabit.color,
          icon: initialHabit.icon || "Flame",
          start_date: initialHabit.start_date ?? undefined,
          habit_type: initialHabit.habit_type ?? "boolean",
          frequency_count: initialHabit.frequency_count ?? 1,
          frequency_period: initialHabit.frequency_period ?? "day",
          target_type: initialHabit.target_type ?? "at_least",
          target_value: initialHabit.target_value ?? undefined,
          unit: initialHabit.unit ?? "",
          question: initialHabit.question ?? "",
          reminder_time: initialHabit.reminder_time ?? null,
          reminder_days: initialHabit.reminder_days ?? REMINDER_EVERY_DAY,
        });
        void triggerValidation();
      } else {
        reset({
          name: "",
          description: "",
          color: "#4B6CB7",
          icon: "Flame",
          start_date: undefined,
          habit_type: "boolean",
          frequency_count: 1,
          frequency_period: "day",
          target_type: "at_least",
          target_value: undefined,
          unit: "",
          question: "",
          reminder_time: null,
          reminder_days: REMINDER_EVERY_DAY,
        });
      }
    }
  }, [open, initialHabit, reset, triggerValidation]);

  const onFormSubmit = useCallback(
    (data: CreateHabitInput) => {
      triggerHaptic("thud");

      const formattedData = {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        start_date:
          data.start_date instanceof Date
            ? data.start_date.toISOString().split("T")[0]
            : data.start_date,
        habit_type: data.habit_type,
        frequency_count: data.frequency_count,
        frequency_period: data.frequency_period,
        target_type: data.target_type,
        target_value: data.target_value,
        unit: data.unit,
        question: data.question,
        reminder_time: data.reminder_time,
        reminder_days: data.reminder_days,
      };

      if (initialHabit) {
        updateMutation.mutate({
          ...formattedData,
          // undefined would leave the stored target untouched.
          target_value: data.target_value ?? null,
          id: initialHabit.id,
        });
      } else {
        createMutation.mutate(formattedData);
      }

      onClose();
    },
    [initialHabit, updateMutation, createMutation, onClose, triggerHaptic],
  );

  const handleDelete = useCallback(() => {
    if (!initialHabit) return;
    setShowDeleteDialog(true);
  }, [initialHabit]);

  const handleConfirmDelete = useCallback(() => {
    if (!initialHabit) return;
    setShowDeleteDialog(false);
    onClose();
    deleteMutation.mutate(initialHabit.id);
  }, [initialHabit, onClose, deleteMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit(onFormSubmit)();
      }
    },
    [handleSubmit, onFormSubmit],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreationMode = !effectiveHabit;

  const sharedViewProps = {
    name,
    setName: (v: string) => setValue("name", v, { shouldValidate: true }),
    description,
    setDescription: (v: string) =>
      setValue("description", v, { shouldValidate: true }),
    color,
    setColor: (v: string) => setValue("color", v, { shouldValidate: true }),
    icon,
    setIcon: (v: string) => setValue("icon", v, { shouldValidate: true }),
    startDate: startDate ? new Date(startDate as string) : undefined,
    setStartDate: (v: Date | undefined) =>
      setValue("start_date", v?.toISOString().split("T")[0], {
        shouldValidate: true,
      }),
    habitType,
    setHabitType: (v: CreateHabitInput["habit_type"]) =>
      setValue("habit_type", v, { shouldValidate: true }),
    frequencyCount,
    setFrequencyCount: (v: number) =>
      setValue("frequency_count", v, { shouldValidate: true }),
    frequencyPeriod,
    setFrequencyPeriod: (v: CreateHabitInput["frequency_period"]) =>
      setValue("frequency_period", v, { shouldValidate: true }),
    targetValue,
    setTargetValue: (v: number | undefined) =>
      setValue("target_value", v, { shouldValidate: true }),
    targetType,
    setTargetType: (v: CreateHabitInput["target_type"]) =>
      setValue("target_type", v, { shouldValidate: true }),
    unit,
    setUnit: (v: string) => setValue("unit", v, { shouldValidate: true }),
    question,
    setQuestion: (v: string) =>
      setValue("question", v, { shouldValidate: true }),
    reminderTime,
    setReminderTime: (v: string | null) =>
      setValue("reminder_time", v, { shouldValidate: true }),
    reminderDays,
    setReminderDays: (v: number) =>
      setValue("reminder_days", v, { shouldValidate: true }),
    datePickerOpen,
    setDatePickerOpen,
    isMobile,
    hasContent: isValid,
    isPending,
    onSubmit: handleSubmit(onFormSubmit),
    onKeyDown: handleKeyDown,
    errors,
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent
        className={cn(
          "w-full gap-0 rounded-lg p-0 overflow-hidden outline-none sm:grid-cols-[minmax(0,1fr)] sm:max-w-lg",
        )}
      >
        <div
          className={cn(
            "flex flex-col",
            isDrawer ? "flex-1 min-h-0" : "max-h-[90dvh]",
          )}
        >
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>
              {initialHabit ? "Edit Habit" : "New Habit"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {initialHabit
                ? "Update your habit details and tracking frequency."
                : "Create a new habit to start tracking your daily progress."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {!isCreationMode && (
            <div className="px-4 pt-3 pb-1 shrink-0">
              <SheetTabToggle
                value={tab}
                onValueChange={(next) => startTransition(() => setTab(next))}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
            {tab === "insights" && !isCreationMode ? (
              <HabitInsightsPanel habit={effectiveHabit!} />
            ) : isCreationMode ? (
              <HabitView mode="create" {...sharedViewProps} />
            ) : (
              <HabitView
                mode="edit"
                onDelete={handleDelete}
                {...sharedViewProps}
              />
            )}
          </div>
        </div>
      </ResponsiveDialogContent>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Habit"
        description={`Are you sure you want to delete "${initialHabit?.name}"? This will also delete all completion history.`}
      />
    </ResponsiveDialog>
  );
}
