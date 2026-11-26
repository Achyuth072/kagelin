"use client";

import React from "react";
import { Calendar, Check, Moon, Play, Trash2 } from "lucide-react";
import { StepProgressBadge } from "./StepProgressBadge";
import { PriorityGlyph } from "./PriorityGlyph";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import { formatDueDate, isOverdue, taskDomId } from "./task-utils";
import { DoDateChip } from "./shared/DoDateChip";
import { ReadableText } from "@/components/encryption/ReadableText";

interface BoardTaskCardProps {
  task: Task;
  project: { color: string; name: string | null } | undefined;
  handleComplete: (checked: boolean) => void;
  handlePlayFocus: (e: React.MouseEvent) => void;
  onDeleteRequest?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  shouldAnimate?: boolean;
  toggleExpand?: (e: React.MouseEvent) => void;
  isExpanded?: boolean;
  isKeyboardSelected?: boolean;
}

export function BoardTaskCard({
  task,
  project,
  handleComplete,
  handlePlayFocus,
  onDeleteRequest,
  onClick,
  shouldAnimate,
  isKeyboardSelected,
}: BoardTaskCardProps) {
  return (
    <div
      id={taskDomId(task.id)}
      role="gridcell"
      aria-selected={isKeyboardSelected}
      aria-current={isKeyboardSelected ? "true" : undefined}
      data-vim-focused={isKeyboardSelected ? "true" : undefined}
      className={cn(
        "relative bg-background border border-border/80 cursor-pointer group/card rounded-xl overflow-hidden transition-[color,background-color,border-color,transform] duration-150",
        isKeyboardSelected
          ? "border-l-2 border-brand-text bg-accent hover:bg-accent hover:border-l-brand-text z-10"
          : "hover:border-border",
      )}
      onClick={onClick}
    >
      {project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: project.color }}
        />
      )}

      <div className="flex flex-col gap-2 w-full text-left p-3 pl-4">
        <div className="flex items-start gap-2">
          <div
            className="-m-3.5 p-3.5 flex items-center justify-center shrink-0"
            onClick={(e) => e.stopPropagation()}
            data-testid="board-checkbox-container"
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
                  "w-3.5 h-3.5 rounded-[3.5px] border transition-colors duration-150 flex items-center justify-center",
                  task.is_completed
                    ? "bg-foreground border-foreground text-background"
                    : "border-border/80 group-hover/card:border-brand bg-card",
                )}
              >
                {task.is_completed && (
                  <Check className="h-2.5 w-2.5" strokeWidth={2.25} />
                )}
              </span>
            </button>
          </div>

          <p className="text-sm font-medium leading-tight flex-1 min-w-0">
            <span
              className={cn(task.is_completed && "task-ink-completed-text")}
              data-animate={shouldAnimate ? "true" : "false"}
            >
              <ReadableText text={task.content} />
            </span>
          </p>

          {/* Pre-allocated zero-jump action cluster */}
          {!task.is_completed && (
            <div
              data-testid="board-hover-actions"
              className="flex w-14 justify-end items-center gap-1 flex-shrink-0 transition-opacity opacity-100 md:opacity-0 md:group-hover/card:opacity-100 focus-within:opacity-100"
            >
              <button
                type="button"
                title="Focus (f)"
                aria-label="Start focus timer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayFocus(e);
                }}
                className="h-9 w-9 md:h-7 md:w-7 flex items-center justify-center rounded text-muted-foreground hover:text-brand hover:bg-secondary/50 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" strokeWidth={2.25} />
              </button>
              {onDeleteRequest && (
                <button
                  type="button"
                  title="Delete (d)"
                  aria-label="Delete task"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRequest(e);
                  }}
                  className="h-9 w-9 md:h-7 md:w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-secondary/50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-6">
          <DoDateChip doDate={task.do_date} isCompleted={task.is_completed} />

          {/* Due Date Chip */}
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border",
                !task.is_completed && isOverdue(task.due_date)
                  ? "bg-secondary/70 border-border/80 text-foreground font-semibold"
                  : "bg-secondary/35 border-border/40 text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" strokeWidth={2.25} />
              <span>{formatDueDate(task.due_date)}</span>
            </span>
          )}

          {/* Priority Chip */}
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
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/35 border border-border/40 text-foreground/80">
              <Moon className="h-3 w-3 fill-current" strokeWidth={2.25} />
              <span>Evening</span>
            </span>
          )}

          <StepProgressBadge subtasks={task.subtasks} />
        </div>
      </div>
    </div>
  );
}
