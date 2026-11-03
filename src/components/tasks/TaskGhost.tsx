import React from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import type { TaskViewMode } from "@/lib/types/sorting";
import {
  formatDueDate,
  isOverdue,
  priorityCheckboxClasses,
  priorityTextClasses,
} from "./task-utils";
import { DragHandle } from "./DragHandle";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Flag, Moon } from "lucide-react";
import { StepProgressBadge } from "./StepProgressBadge";
import { ReadableText } from "@/components/encryption/ReadableText";

interface TaskGhostProps {
  task: Task;
  isDesktop: boolean;
  project?: { color: string; name: string | null };
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
    const hasMetadata = Boolean(
      task.due_date ||
      task.priority < 4 ||
      task.subtasks?.length ||
      task.is_evening,
    );

    if (viewMode === "board") {
      return (
        <div
          className={cn(
            "touch-none opacity-98 transition-all duration-200",
            "bg-background border border-primary/20 shadow-sm rounded-xl relative overflow-hidden cursor-grabbing w-full",
          )}
        >
          {/* Shodo Accent Stripe */}
          {project && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: project.color }}
            />
          )}

          <div className="flex flex-col gap-2 w-full text-left p-3 pl-4">
            {/* Header Row */}
            <div className="flex items-start gap-2">
              <div className="pt-0.5">
                <Checkbox
                  checked={task.is_completed}
                  className={cn(
                    priorityCheckboxClasses[task.priority],
                    "h-4 w-4 !rounded-sm",
                  )}
                  style={{
                    borderColor: task.is_completed ? "var(--brand)" : undefined,
                  }}
                  disabled
                />
              </div>

              <p className="text-sm font-medium leading-tight flex-1">
                <span
                  className={cn(task.is_completed && "task-ink-completed-text")}
                  data-animate="false"
                >
                  <ReadableText text={task.content} />
                </span>
              </p>
            </div>

            {/* Metadata Row */}
            {hasMetadata && (
              <div className="flex items-center gap-2.5 flex-wrap ml-6">
                {task.due_date && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    <Calendar className="h-3 w-3" strokeWidth={2.5} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {task.priority < 4 && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider",
                      priorityTextClasses[task.priority],
                    )}
                  >
                    <Flag className="h-3 w-3" strokeWidth={2.5} />P
                    {task.priority}
                  </span>
                )}
                {task.is_evening && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/80 uppercase tracking-wider">
                    <Moon className="h-3 w-3 fill-current" />
                    Evening
                  </span>
                )}
                <StepProgressBadge
                  subtasks={task.subtasks}
                  className="type-ui gap-1.5"
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex items-center w-full gap-2 md:gap-3 touch-none opacity-98 transition-all duration-200",
          "bg-background border border-primary/20 shadow-sm rounded-xl relative overflow-hidden px-4 py-3",
        )}
      >
        {/* Shodo Accent Stripe */}
        {project && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5"
            style={{ backgroundColor: project.color }}
          />
        )}

        {isDesktop && (
          <DragHandle
            variant="desktop"
            className="text-foreground/40 shrink-0 ml-1"
          />
        )}

        <div
          className={cn("shrink-0", isDesktop ? "pt-0" : "pt-0.5 p-3 -ml-3")}
        >
          <Checkbox
            checked={task.is_completed}
            className={cn(
              priorityCheckboxClasses[task.priority],
              isDesktop ? "h-4 w-4 !rounded-sm" : "h-5 w-5 !rounded-md",
            )}
            style={{
              borderColor: task.is_completed ? "var(--brand)" : undefined,
            }}
            disabled
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5 ml-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="type-body font-medium leading-tight truncate flex-1 min-w-0">
              <span
                className={cn(task.is_completed && "task-ink-completed-text")}
                data-animate="false"
              >
                <ReadableText text={task.content} />
              </span>
            </p>
          </div>

          {hasMetadata && (
            <div className="flex items-center gap-3 mt-0.5 ml-[2px] mb-1">
              {task.due_date && (
                <span
                  className={cn(
                    "type-ui flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap",
                    isOverdue(task.due_date)
                      ? "text-foreground font-bold"
                      : "text-muted-foreground/70",
                  )}
                >
                  <Calendar className="h-3 w-3" strokeWidth={2.5} />
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {task.priority < 4 && (
                <span
                  className={cn(
                    "type-ui flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap",
                    priorityTextClasses[task.priority],
                  )}
                >
                  <Flag className="h-3 w-3" strokeWidth={2.5} />P{task.priority}
                </span>
              )}
              {task.is_evening && (
                <span className="type-ui flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 uppercase tracking-wider whitespace-nowrap">
                  <Moon className="h-3 w-3 fill-current" strokeWidth={2.5} />
                  Evening
                </span>
              )}
              <StepProgressBadge
                subtasks={task.subtasks}
                className="type-ui gap-1.5"
              />
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
      prev.task.due_date === next.task.due_date &&
      prev.task.is_evening === next.task.is_evening &&
      prev.task.subtasks === next.task.subtasks &&
      prev.viewMode === next.viewMode &&
      prev.isDesktop === next.isDesktop &&
      prev.project?.color === next.project?.color
    );
  },
);
