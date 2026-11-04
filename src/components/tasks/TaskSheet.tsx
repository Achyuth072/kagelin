"use client";

import { useState, startTransition } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import type { Task } from "@/lib/types/task";
import { TaskView } from "./TaskView";
import { TaskInsightsPanel } from "./TaskInsightsPanel";
import { SheetTabToggle, type SheetTab } from "@/components/ui/SheetTabToggle";
import { cn } from "@/lib/utils";
import { TaskEditorProvider } from "./TaskEditorProvider";

interface TaskSheetProps {
  open: boolean;
  onClose: () => void;
  initialTask?: Task | null;
  initialDate?: Date | null;
  initialContent?: string;
  initialTab?: SheetTab;
}

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
  const hasSeries = !!effectiveTask?.recurring_series_id;
  const isCreationMode = !effectiveTask;

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTask, setPrevTask] = useState(initialTask);
  const [tab, setTab] = useState<SheetTab>(
    initialTab === "insights" && hasSeries ? "insights" : "edit",
  );

  if (open !== prevOpen || initialTask !== prevTask) {
    setPrevOpen(open);
    setPrevTask(initialTask);
    if (open) {
      setTab(initialTab === "insights" && hasSeries ? "insights" : "edit");
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent
        className={cn(
          "w-full gap-0 rounded-lg p-0 overflow-hidden outline-none sm:grid-cols-[minmax(0,1fr)] sm:max-w-lg border-border/80",
        )}
      >
        <div className="flex flex-col max-h-[90dvh] min-w-0">
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>
              {effectiveTask ? "Edit Task" : "New Task"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {effectiveTask
                ? "Update existing task details"
                : "Create a new task with content and metadata"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {!isCreationMode && hasSeries && (
            <div className="px-4 pt-3 pb-1 shrink-0">
              <SheetTabToggle
                value={tab}
                onValueChange={(next) => startTransition(() => setTab(next))}
              />
            </div>
          )}

          <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
            {tab === "insights" && hasSeries ? (
              <TaskInsightsPanel task={effectiveTask!} />
            ) : (
              <TaskEditorProvider
                task={effectiveTask}
                open={open}
                onClose={onClose}
                autoFocusTitle={true}
                initialDate={initialDate}
                initialContent={initialContent}
              >
                <TaskView layout="sheet" />
              </TaskEditorProvider>
            )}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
