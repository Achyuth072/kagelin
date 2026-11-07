"use client";

import React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Calendar,
  CalendarClock,
  Moon,
  Play,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import { format, isToday, parseISO } from "date-fns";
import { formatDueDate, isOverdue, taskDomId } from "./task-utils";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { DragHandle } from "./DragHandle";
import { ReadableText } from "@/components/encryption/ReadableText";
import { PriorityGlyph } from "./PriorityGlyph";

interface ListTaskCardProps {
  task: Task;
  isDesktop: boolean;
  isExpanded: boolean;
  toggleExpand: (e: React.MouseEvent) => void;
  handleComplete: (checked: boolean) => void;
  handlePlayFocus: (e: React.MouseEvent) => void;
  onDeleteRequest: (e: React.MouseEvent) => void;
  project: { color: string; name: string | null } | undefined;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  onHandlePointerDown?: () => void;
  onHandlePointerUp?: () => void;
  dragActivatorRef?: (element: HTMLElement | null) => void;
  shouldAnimate?: boolean;
  isKeyboardSelected?: boolean;
}

export function ListTaskCard({
  task,
  isDesktop,
  isExpanded,
  toggleExpand,
  handleComplete,
  handlePlayFocus,
  onDeleteRequest,
  project,
  dragListeners,
  dragAttributes,
  onHandlePointerDown,
  onHandlePointerUp,
  dragActivatorRef,
  shouldAnimate = false,
  isKeyboardSelected = false,
}: ListTaskCardProps) {
  const isPlannedToday = !!task.do_date && isToday(parseISO(task.do_date));
  const completedSteps =
    task.subtasks?.filter((s) => s.is_completed).length ?? 0;
  const totalSteps = task.subtasks?.length ?? 0;

  return (
    <div
      id={taskDomId(task.id)}
      role="row"
      aria-selected={isKeyboardSelected}
      aria-description={
        !isDesktop && !task.is_completed
          ? "Swipe right to complete, swipe left to delete"
          : undefined
      }
      className={cn(
        "group relative flex items-start p-3.5 sm:p-4 pl-4 sm:pl-5 transition-colors cursor-pointer select-none border-b border-border/40 hover:bg-secondary/10 w-full touch-manipulation",
        isKeyboardSelected
          ? "ring-2 ring-primary ring-inset bg-secondary/40 z-10 rounded-xl"
          : "",
      )}
      data-task-row
      data-testid="task-list-row"
      {...(!isDesktop ? dragAttributes : {})}
      {...(!isDesktop ? dragListeners : {})}
    >
      {/* Accent stripe */}
      {project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 sm:w-1.5"
          style={{ backgroundColor: project.color }}
        />
      )}

      {isDesktop && (
        <DragHandle
          ref={dragActivatorRef}
          dragListeners={dragListeners}
          dragAttributes={dragAttributes}
          variant="desktop"
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          className="-ml-1 mr-0.5 shrink-0 self-center"
        />
      )}

      {/* Left: Accessible 44px Checkbox Container with Left & Right Breathing Room */}
      <div
        role="gridcell"
        className="pt-0.5 pl-1 sm:pl-2 pr-3 sm:pr-4 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-checkbox-container"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={task.is_completed}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete(!task.is_completed);
          }}
          aria-label={`Toggle complete ${task.content ?? ""}`}
          className="h-11 w-11 -m-3.5 flex items-center justify-center transition-colors rounded-full hover:bg-secondary/40"
        >
          <span
            className={cn(
              "w-3.5 h-3.5 rounded-[3.5px] border transition-all flex items-center justify-center",
              task.is_completed
                ? "bg-foreground border-foreground text-background"
                : "border-border/80 group-hover:border-brand bg-card",
            )}
          >
            {task.is_completed && (
              <Check className="h-2.5 w-2.5 stroke-[3.5]" />
            )}
          </span>
        </button>
      </div>

      {/* Center: Full-Width Vertical Stack */}
      <div role="gridcell" className="flex-1 min-w-0 pr-1">
        {/* Top row: Title + Priority Glyph + Desktop Hover Actions (ZERO JUMP) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <p className="text-[14px] sm:text-[15px] font-medium leading-snug break-words transition-colors flex-1 min-w-0">
              <span
                className={cn(
                  task.is_completed &&
                    "task-ink-completed-text line-through text-muted-foreground/60",
                )}
                data-animate={shouldAnimate}
              >
                <ReadableText text={task.content} />
              </span>
            </p>
            {task.priority < 4 && <PriorityGlyph level={task.priority} />}
          </div>

          {/* Desktop Hover Action Cluster (STABLE WIDTH, OPACITY-FADE = ZERO LAYOUT SHIFT) */}
          <div
            data-testid="hover-action-cluster"
            className="hidden md:flex w-14 justify-end items-center gap-1 flex-shrink-0 opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 pointer-events-none md:group-hover:pointer-events-auto"
          >
            <button
              type="button"
              title="Focus (f)"
              aria-label="Start focus timer"
              onClick={handlePlayFocus}
              className="p-1 rounded text-muted-foreground hover:text-brand hover:bg-secondary/50 transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
            <button
              type="button"
              title="Delete (d)"
              aria-label="Delete task"
              onClick={onDeleteRequest}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary/50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom row: Tactile Metadata Chip Stack (Properly Padded) */}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          {/* Do Date (Planned Today) Chip */}
          {task.do_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border",
                isPlannedToday
                  ? "bg-secondary/70 border-border/80 text-foreground font-semibold"
                  : "bg-secondary/35 border-border/40 text-muted-foreground",
              )}
            >
              <CalendarClock className="h-3 w-3 stroke-[2.25]" />
              <span>
                {isPlannedToday
                  ? "Planned Today"
                  : format(parseISO(task.do_date), "MMM d")}
              </span>
            </span>
          )}

          {/* Due Date Chip */}
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors",
                isOverdue(task.due_date)
                  ? "bg-secondary/70 border-border/80 text-foreground font-semibold"
                  : "bg-secondary/35 border-border/40 text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3 stroke-[2.25]" />
              <span>Due {formatDueDate(task.due_date)}</span>
            </span>
          )}

          {/* Priority Meta Tag Chip */}
          {task.priority < 4 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-secondary/35 border border-border/40 text-foreground">
              <PriorityGlyph level={task.priority} />
              <span>P{task.priority}</span>
            </span>
          )}

          {/* Project Chip */}
          {project && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/35 border border-border/40 text-muted-foreground">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span>{project.name || "Inbox"}</span>
            </span>
          )}

          {/* Evening Chip */}
          {task.is_evening && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/35 border border-border/40 text-muted-foreground">
              <Moon className="h-3 w-3 fill-current" />
              <span>Evening</span>
            </span>
          )}

          {/* Steps fraction button */}
          {totalSteps > 0 && (
            <button
              type="button"
              onClick={toggleExpand}
              aria-label={isExpanded ? "Collapse steps" : "Expand steps"}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary/40 hover:bg-secondary/70 border border-border/50 text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>
                {completedSteps}/{totalSteps} steps
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
