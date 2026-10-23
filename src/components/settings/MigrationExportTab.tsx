"use client";

import { Database, FileDown, Loader2 } from "lucide-react";
import { BetaBadge } from "@/components/ui/beta-badge";
import { useAuth } from "@/components/AuthProvider";
import { useHabits } from "@/lib/hooks/useHabits";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useUhabitsExport } from "@/lib/hooks/useUhabitsExport";
import { useTodoistExport } from "@/lib/hooks/useTodoistExport";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { mockStore } from "@/lib/mock/mock-store";
import { cn } from "@/lib/utils";
import { LoopIcon, TodoistIcon } from "./MigrationIcons";

export function formatHabitSummary(count: number): string {
  if (count === 0) {
    return "No habits to export";
  }
  return count === 1
    ? "1 habit ready to export"
    : `${count} habits ready to export`;
}

export function formatTodoistSummary(
  taskCount: number,
  projectCount: number,
): string {
  if (taskCount === 0) {
    return "No active tasks";
  }
  const taskLabel = taskCount === 1 ? "1 task" : `${taskCount} tasks`;
  if (projectCount === 0) {
    return taskLabel;
  }
  const projectLabel =
    projectCount === 1 ? "1 project" : `${projectCount} projects`;
  return `${taskLabel} across ${projectLabel}`;
}

export interface MigrationExportTabProps {
  className?: string;
}

function getGuestCounts() {
  const activeProjects = mockStore.getProjects().filter((p) => !p.is_archived);
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));

  return {
    habitCount: mockStore.getHabits().filter((h) => !h.archived_at).length,
    projectCount: activeProjects.length,
    taskCount: mockStore
      .getTasks()
      .filter(
        (t) =>
          !t.is_completed &&
          (!t.project_id || activeProjectIds.has(t.project_id)),
      ).length,
  };
}

export function MigrationExportTab({ className }: MigrationExportTabProps) {
  const { isGuestMode } = useAuth();
  const { trigger } = useHaptic();

  const habitsQuery = useHabits();
  const tasksQuery = useTasks({ showCompleted: false });
  const projectsQuery = useProjects();

  const {
    exportLoopDb,
    exportLoopZip,
    isExporting: isExportingLoop,
  } = useUhabitsExport();
  const { exportTodoistZip, isExporting: isExportingTodoist } =
    useTodoistExport();

  const guestCounts = isGuestMode ? getGuestCounts() : null;

  const habitCount =
    guestCounts?.habitCount ??
    habitsQuery.data?.filter((h) => !h.archived_at).length ??
    0;

  const projectCount =
    guestCounts?.projectCount ??
    (projectsQuery.data ?? []).filter((p) => !p.is_archived && !p.is_inbox)
      .length;

  const taskCount =
    guestCounts?.taskCount ??
    (tasksQuery.data ?? []).reduce(
      (acc, t) =>
        acc +
        (t.is_completed ? 0 : 1) +
        (t.subtasks?.filter((s) => !s.is_completed).length ?? 0),
      0,
    );

  const habitSummary = formatHabitSummary(habitCount);
  const todoistSummary = formatTodoistSummary(taskCount, projectCount);

  const runExport = async (action: () => Promise<unknown>) => {
    trigger("toggle");
    await action();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Loop Habit Tracker Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all gap-3">
        <div className="flex items-center gap-3">
          <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
          <div>
            <h3 className="text-sm font-medium leading-snug">
              Loop Habit
              <span className="flex items-center gap-1.5">
                Tracker
                <BetaBadge />
              </span>
            </h3>
            <p className="text-xs text-muted-foreground lowercase mt-0.5">
              {habitSummary}
            </p>
          </div>
        </div>
        {/* Unified segmented control: slim h-7 container with compact micro typography */}
        <div className="inline-flex items-center h-7 bg-secondary/20 p-0.5 rounded-md border border-border/40 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => runExport(exportLoopDb)}
            disabled={isExportingLoop}
            className="inline-flex items-center h-full gap-1.5 px-2.5 rounded text-xs font-medium tracking-tight hover:bg-secondary/50 active:bg-secondary/70 text-foreground transition-all motion-reduce:transition-none disabled:opacity-50"
            aria-label="Export Loop Habit Tracker database"
          >
            {isExportingLoop ? (
              <Loader2
                className="h-3 w-3 animate-spin text-brand"
                strokeWidth={2.25}
              />
            ) : (
              <Database className="h-3 w-3 text-brand" strokeWidth={2.25} />
            )}
            <span>.db</span>
          </button>
          <div className="h-3 w-[1px] bg-border/40 mx-0.5" />
          <button
            type="button"
            onClick={() => runExport(exportLoopZip)}
            disabled={isExportingLoop}
            className="inline-flex items-center h-full gap-1.5 px-2.5 rounded text-xs font-medium tracking-tight hover:bg-secondary/50 active:bg-secondary/70 text-foreground transition-all motion-reduce:transition-none disabled:opacity-50"
            aria-label="Export Loop Habit Tracker CSV archive"
          >
            {isExportingLoop ? (
              <Loader2
                className="h-3 w-3 animate-spin text-brand"
                strokeWidth={2.25}
              />
            ) : (
              <FileDown className="h-3 w-3 text-brand" strokeWidth={2.25} />
            )}
            <span>CSV Zip</span>
          </button>
        </div>
      </div>

      {/* Todoist Card */}
      <div
        role="button"
        tabIndex={isExportingTodoist ? -1 : 0}
        aria-disabled={isExportingTodoist}
        onClick={() => {
          if (!isExportingTodoist) {
            void runExport(exportTodoistZip);
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isExportingTodoist) {
            e.preventDefault();
            void runExport(exportTodoistZip);
          }
        }}
        className={cn(
          "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group",
          isExportingTodoist &&
            "pointer-events-none opacity-60 cursor-not-allowed",
        )}
        aria-label="Export Todoist ZIP archive"
      >
        <div className="flex items-center gap-3">
          <TodoistIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
          <div>
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              Todoist
              <BetaBadge />
            </h3>
            <p className="text-xs text-muted-foreground lowercase">
              {todoistSummary}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center h-7 bg-secondary/20 p-0.5 rounded-md border border-border/40">
          <button
            type="button"
            disabled={isExportingTodoist}
            tabIndex={-1}
            className="inline-flex items-center h-full gap-1.5 px-2.5 rounded text-xs font-medium tracking-tight text-foreground disabled:opacity-50"
            aria-hidden="true"
          >
            {isExportingTodoist ? (
              <Loader2
                className="h-3 w-3 animate-spin text-brand"
                strokeWidth={2.25}
              />
            ) : (
              <FileDown className="h-3 w-3 text-brand" strokeWidth={2.25} />
            )}
            <span>.zip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
