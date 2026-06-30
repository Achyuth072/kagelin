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
import type { Habit } from "@/lib/types/habit";
import { HabitCreateView } from "./HabitCreateView";
import { HabitEditView } from "./HabitEditView";
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
  // Logic to prevent flickering between Create/Edit modes during close animation
  const [preservedHabit, setPreservedHabit] = useState<
    Habit | null | undefined
  >(initialHabit);

  if (open && initialHabit !== preservedHabit) {
    setPreservedHabit(initialHabit);
  }

  const effectiveHabit = open ? initialHabit : preservedHabit;

  // Reset the tab on every open transition (not just when initialHabit
  // changes) — reopening the same habit via "View stats" must still land on
  // Insights even though the habit object reference is unchanged.
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
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Watch values for child components
  const name = useWatch({ control, name: "name" });
  const description = useWatch({ control, name: "description" }) || "";
  const color = useWatch({ control, name: "color" }) || "#4B6CB7";
  const icon = useWatch({ control, name: "icon" }) || "Flame";
  const startDate = useWatch({ control, name: "start_date" });

  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit();
  const deleteMutation = useDeleteHabit();
  const isMobile = useMediaQuery("(max-width: 768px)");
  // Matches ResponsiveDialog's own Dialog/Drawer breakpoint exactly — the
  // drawer is a true flex column so flex-1/min-h-0 sizes correctly, while
  // the desktop dialog is a CSS grid where only an explicit max-height
  // resolves (percentage/flex sizing against its auto-height box doesn't).
  const isDrawer = useMediaQuery("(max-width: 640px)");
  const { trigger: triggerHaptic } = useHaptic();

  // Sync form with initialHabit on open
  useEffect(() => {
    if (open) {
      if (initialHabit) {
        reset({
          name: initialHabit.name,
          description: initialHabit.description || "",
          color: initialHabit.color,
          icon: initialHabit.icon || "Flame",
          start_date: initialHabit.start_date ?? undefined,
        });
        void triggerValidation();
      } else {
        reset({
          name: "",
          description: "",
          color: "#4B6CB7",
          icon: "Flame",
          start_date: undefined,
        });
      }
    }
  }, [open, initialHabit, reset, triggerValidation]);

  const onFormSubmit = useCallback(
    (data: CreateHabitInput) => {
      triggerHaptic("thud");

      const formattedData = {
        ...data,
        start_date:
          data.start_date instanceof Date
            ? data.start_date.toISOString().split("T")[0]
            : data.start_date,
      };

      if (initialHabit) {
        updateMutation.mutate({
          ...formattedData,
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
            <div className="px-4 pt-3 pb-1 shrink-0 sm:pr-16">
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
              <HabitCreateView
                name={name}
                setName={(v) => setValue("name", v, { shouldValidate: true })}
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                color={color}
                setColor={(v) => setValue("color", v, { shouldValidate: true })}
                icon={icon}
                setIcon={(v) => setValue("icon", v, { shouldValidate: true })}
                startDate={
                  startDate ? new Date(startDate as string) : undefined
                }
                setStartDate={(v) =>
                  setValue("start_date", v?.toISOString().split("T")[0], {
                    shouldValidate: true,
                  })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
                isMobile={isMobile}
                hasContent={isValid}
                isPending={isPending}
                onSubmit={handleSubmit(onFormSubmit)}
                onKeyDown={handleKeyDown}
                errors={errors}
              />
            ) : (
              <HabitEditView
                _initialHabit={effectiveHabit!}
                name={name}
                setName={(v) => setValue("name", v, { shouldValidate: true })}
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                color={color}
                setColor={(v) => setValue("color", v, { shouldValidate: true })}
                icon={icon}
                setIcon={(v) => setValue("icon", v, { shouldValidate: true })}
                startDate={
                  startDate ? new Date(startDate as string) : undefined
                }
                setStartDate={(v) =>
                  setValue("start_date", v?.toISOString().split("T")[0], {
                    shouldValidate: true,
                  })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
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
        title="Delete Habit"
        description={`Are you sure you want to delete "${initialHabit?.name}"? This will also delete all completion history.`}
      />
    </ResponsiveDialog>
  );
}
