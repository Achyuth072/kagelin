"use client";

import { useState, useCallback, memo } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TaskDetailPanel } from "./TaskDetailPanel";
import TaskList from "./TaskList";
import type { Task } from "@/lib/types/task";
import type { SortOption, GroupOption } from "@/lib/types/sorting";

interface SplitViewLayoutProps {
  sortBy?: SortOption;
  groupBy?: GroupOption;
  projectId?: string;
  filter?: string;
}

function SplitViewLayoutBase({
  sortBy = "date",
  groupBy = "none",
  projectId,
  filter,
}: SplitViewLayoutProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { trigger } = useHaptic();
  // Below 1024px, a 40% side panel is too thin for the detail form (cramped
  // footer, wrapped badges) — show task details in a modal instead.
  const isWideSplit = useMediaQuery("(min-width: 1024px)");

  const handleTaskSelect = useCallback(
    (task: Task) => {
      trigger("toggle"); // Toggle haptic for selection
      setSelectedTask(task);
    },
    [trigger],
  );

  const handleCloseDetail = useCallback(() => {
    trigger("tick"); // Tick haptic for close
    setSelectedTask(null);
  }, [trigger]);

  if (!isWideSplit) {
    return (
      <>
        <div className="h-full w-full overflow-hidden">
          <TaskList
            sortBy={sortBy}
            groupBy={groupBy}
            projectId={projectId}
            filter={filter}
            onTaskSelect={handleTaskSelect}
          />
        </div>

        <Dialog
          open={!!selectedTask}
          onOpenChange={(open) => !open && handleCloseDetail()}
        >
          <DialogContent
            showClose={false}
            className="max-w-2xl h-[85dvh] max-h-[85dvh] p-0 gap-0 rounded-2xl overflow-hidden flex flex-col"
          >
            <DialogTitle className="sr-only">
              {selectedTask?.content ?? "Task details"}
            </DialogTitle>
            <TaskDetailPanel task={selectedTask} onClose={handleCloseDetail} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="w-[60%] h-full overflow-hidden">
        <TaskList
          sortBy={sortBy}
          groupBy={groupBy}
          projectId={projectId}
          filter={filter}
          onTaskSelect={handleTaskSelect}
        />
      </div>

      <div className="w-[40%] h-full overflow-hidden p-4 md:p-6 lg:p-8">
        <div className="h-full w-full rounded-2xl border border-border bg-background/50 overflow-hidden shadow-sm">
          <TaskDetailPanel task={selectedTask} onClose={handleCloseDetail} />
        </div>
      </div>
    </div>
  );
}

export const SplitViewLayout = memo(SplitViewLayoutBase);
