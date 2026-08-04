import React from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import type { TaskViewMode } from "@/lib/types/sorting";
import { formatDueDate } from "./task-utils";
import { DragHandle } from "./DragHandle";
import { Checkbox } from "@/components/ui/checkbox";
import { priorityCheckboxClasses, priorityTextClasses } from "./task-utils";
import { Calendar, Flag, Moon } from "lucide-react";

interface TaskGhostProps {
  task: Task;
  isDesktop: boolean;
  project?: { color: string; name: string };
  viewMode?: TaskViewMode;
}

// Read-only task row rendered exclusively in the DnD DragOverlay.
export const TaskGhost = React.memo(
  function TaskGhost({
    task,
    isDesktop,
    project,
    viewMode = "list",
  }: TaskGhostProps) {
    return (
      <div
        className={cn(
          "flex items-center w-full gap-2 md:gap-4 touch-none opacity-98 transition-all duration-200",
          "bg-background/98 border border-border/80 backdrop-blur-xl relative overflow-hidden",
          viewMode === "list"
            ? "px-4 py-3 w-full rounded-xl border-2 border-primary/20 shadow-sm"
            : "p-3 pl-4 rounded-xl border-2 border-primary/20 shadow-sm cursor-grabbing w-70",
        )}
      >
        {/* Shodo Accent Stripe */}
        {project && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 z-10",
              viewMode === "list" ? "w-1 md:w-1.5" : "w-1",
            )}
            style={{ backgroundColor: project.color }}
          />
        )}
        {isDesktop && viewMode === "list" && (
          <DragHandle
            variant="desktop"
            className="text-foreground/40 shrink-0 ml-1"
          />
        )}

        <div
          className={cn(
            "flex flex-col w-full text-left",
            viewMode === "board" ? "gap-2" : "gap-0.5",
          )}
        >
          {/* Header Row */}
          <div className="flex items-start gap-2">
            <div className={cn(viewMode === "board" && "pt-0.5")}>
              <Checkbox
                checked={task.is_completed}
                className={cn(
                  "shrink-0 transition-colors",
                  priorityCheckboxClasses[task.priority as 1 | 2 | 3 | 4],
                  isDesktop ? "h-4 w-4 !rounded-[3px]" : "h-5 w-5 !rounded-md",
                )}
                style={{
                  borderColor: task.is_completed ? "var(--brand)" : undefined,
                }}
                disabled
              />
            </div>

            <p
              className={cn(
                "font-medium leading-tight truncate text-foreground",
                viewMode === "board"
                  ? "text-sm flex-1"
                  : "text-sm md:text-base",
              )}
            >
              <span
                className={cn(task.is_completed && "task-ink-completed-text")}
                data-animate="false"
              >
                {task.content}
              </span>
            </p>
          </div>

          {/* Metadata Row */}
          {(task.due_date ||
            task.priority < 4 ||
            project ||
            task.is_evening) && (
            <div className="flex items-center gap-2.5 flex-wrap ml-6 mt-0.5">
              {task.due_date && (
                <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1 font-medium uppercase tracking-wider">
                  <Calendar className="h-3 w-3" strokeWidth={2.25} />
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {task.priority < 4 && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                    priorityTextClasses[task.priority as 1 | 2 | 3 | 4],
                  )}
                >
                  <Flag className="h-3 w-3" strokeWidth={2.5} />P{task.priority}
                </span>
              )}
              {task.is_evening && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/80 uppercase tracking-wider">
                  <Moon className="h-3 w-3 fill-current" />
                  Evening
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.task.id === next.task.id &&
      prev.task.content === next.task.content &&
      prev.task.is_completed === next.task.is_completed &&
      prev.task.priority === next.task.priority &&
      prev.viewMode === next.viewMode &&
      prev.isDesktop === next.isDesktop &&
      prev.project?.color === next.project?.color
    );
  },
);
