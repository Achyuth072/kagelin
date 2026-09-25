"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { useArchivedHabits } from "@/lib/hooks/useHabits";
import {
  useDeleteHabit,
  useUnarchiveHabit,
} from "@/lib/hooks/useHabitMutations";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import type { HabitWithEntries } from "@/lib/types/habit";

interface ArchivedHabitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedHabitsDialog({
  open,
  onOpenChange,
}: ArchivedHabitsDialogProps) {
  const { data: archivedHabits, isLoading } = useArchivedHabits();
  const unarchiveHabit = useUnarchiveHabit();
  const deleteHabit = useDeleteHabit();
  const [habitToDelete, setHabitToDelete] = useState<HabitWithEntries | null>(
    null,
  );

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-md p-0 overflow-hidden">
          <ResponsiveDialogHeader className="px-4 pt-6 shrink-0">
            <ResponsiveDialogTitle className="type-h2">
              Archived Habits
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              View, restore or delete archived habits
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : archivedHabits && archivedHabits.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                {archivedHabits.map((habit) => {
                  const Icon = getHabitIcon(habit.icon);
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className="h-4 w-4 shrink-0"
                          style={{ color: habit.color }}
                        />
                        <span className="font-medium truncate">
                          {habit.name}
                        </span>
                      </div>
                      <div className="flex items-center shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2 hover:bg-secondary"
                          onClick={() => unarchiveHabit.mutate(habit.id)}
                          disabled={unarchiveHabit.isPending}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setHabitToDelete(habit)}
                          aria-label={`Delete ${habit.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Archive}
                title="No archived habits"
                description="Habits you archive will show up here for restoring later."
                className="py-8 gap-4"
              />
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <DeleteConfirmationDialog
        isOpen={habitToDelete !== null}
        onClose={() => setHabitToDelete(null)}
        onConfirm={() => {
          if (habitToDelete) deleteHabit.mutate(habitToDelete.id);
          setHabitToDelete(null);
        }}
        title="Delete Habit"
        description={`Are you sure you want to delete "${habitToDelete?.name}"? This will also delete all completion history.`}
      />
    </>
  );
}
