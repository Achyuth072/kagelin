"use client";

import { useState } from "react";
import { Database, FileDown, Info, Loader2, X } from "lucide-react";
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
  const [showTodoistTip, setShowTodoistTip] = useState(false);

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

  const handleExportTodoist = async () => {
    trigger("toggle");
    const success = await exportTodoistZip();
    if (success) {
      setShowTodoistTip(true);
    }
  };

  const handleDismissTip = () => {
    trigger("tick");
    setShowTodoistTip(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Loop Habit Tracker Card */}
      <div className="flex flex-col min-[360px]:flex-row min-[360px]:items-center justify-between gap-2 py-4 px-3.5 sm:gap-3 sm:p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all">
        <div className="flex items-center gap-2.5 min-[360px]:flex-1 min-w-0">
          <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
          <div className="min-w-0">
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
        <div className="inline-flex items-center h-7 bg-secondary/20 p-0.5 rounded-md border border-border/40 ml-auto shrink-0">
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
            void handleExportTodoist();
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isExportingTodoist) {
            e.preventDefault();
            void handleExportTodoist();
          }
        }}
        className={cn(
          "flex flex-col min-[360px]:flex-row min-[360px]:items-center justify-between gap-2 py-4 px-3.5 sm:gap-3 sm:p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group",
          isExportingTodoist &&
            "pointer-events-none opacity-60 cursor-not-allowed",
        )}
        aria-label="Export Todoist ZIP archive"
      >
        <div className="flex items-center gap-2.5 min-[360px]:flex-1 min-w-0">
          <TodoistIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              Todoist
              <BetaBadge />
            </h3>
            <p className="text-xs text-muted-foreground lowercase">
              {todoistSummary}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center h-7 bg-secondary/20 p-0.5 rounded-md border border-border/40 ml-auto shrink-0">
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

      {showTodoistTip && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed"
        >
          <div className="flex items-start gap-2 min-w-0">
            <Info
              className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground"
              strokeWidth={2.25}
            />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Todoist
              imports CSV files per-project. Unzip the downloaded archive to
              import individual project CSVs into Todoist. Note that Todoist
              requires a paid Pro plan to import the Deadline column.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissTip}
            aria-label="Dismiss tip"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-seijaku-fast motion-reduce:transition-none p-0.5 rounded hover:bg-secondary/40 outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}
