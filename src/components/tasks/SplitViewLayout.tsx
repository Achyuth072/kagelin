"use client";

import { useState, useCallback, useSyncExternalStore, memo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
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

function findCachedTask(
  queryClient: QueryClient,
  taskId: string | undefined,
): Task | undefined {
  if (!taskId) return undefined;
  for (const [, tasks] of queryClient.getQueriesData<Task[]>({
    queryKey: ["tasks"],
  })) {
    const found = tasks?.find((t) => t.id === taskId);
    if (found) return found;
  }
  return undefined;
}

function SplitViewLayoutBase({
  sortBy = "date",
  groupBy = "none",
  projectId,
  filter,
}: SplitViewLayoutProps) {
  const [selection, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  // The selection is a snapshot from click time; edits land in the cache, so
  // read the live copy or the detail form keeps showing pre-edit values.
  const selectedTask = useSyncExternalStore(
    (notify) => queryClient.getQueryCache().subscribe(notify),
    () => findCachedTask(queryClient, selection?.id) ?? selection,
    () => selection,
  );
  const { trigger } = useHaptic();
  // Below 1024px, a 40% side panel is too thin for the detail form (cramped
  // footer, wrapped badges) — show task details in a modal instead.
  const isWideSplit = useMediaQuery("(min-width: 1024px)");

  const handleTaskSelect = useCallback(
    (task: Task) => {
      trigger("toggle");
      setSelectedTask(task);
    },
    [trigger],
  );

  const handleCloseDetail = useCallback(() => {
    trigger("tick");
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
