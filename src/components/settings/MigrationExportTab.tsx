"use client";

import { Database, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const actionButtonClass =
  "flex-1 min-w-[120px] gap-2 h-9 border-border/60 hover:bg-secondary/40 transition-all font-medium";

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
      <div className="rounded-lg border border-border/40 p-4 bg-secondary/10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Loop Habit Tracker</h3>
            <p className="text-xs text-muted-foreground">{habitSummary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runExport(exportLoopDb)}
            disabled={isExportingLoop}
            aria-label="Export Loop Habit Tracker database"
            className={actionButtonClass}
          >
            {isExportingLoop ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Database className="h-4 w-4" strokeWidth={2.25} />
            )}
            Export (.db)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runExport(exportLoopZip)}
            disabled={isExportingLoop}
            aria-label="Export Loop Habit Tracker CSV archive"
            className={actionButtonClass}
          >
            {isExportingLoop ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2.25} />
            )}
            Export (CSV Zip)
          </Button>
        </div>
      </div>

      {/* Todoist Card */}
      <div className="rounded-lg border border-border/40 p-4 bg-secondary/10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <TodoistIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Todoist</h3>
            <p className="text-xs text-muted-foreground">{todoistSummary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runExport(exportTodoistZip)}
            disabled={isExportingTodoist}
            aria-label="Export Todoist ZIP archive"
            className={cn(actionButtonClass, "sm:flex-initial")}
          >
            {isExportingTodoist ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2.25} />
            )}
            Export (.zip)
          </Button>
        </div>
      </div>
    </div>
  );
}
