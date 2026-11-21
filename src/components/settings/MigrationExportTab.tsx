"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileDown,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useHabits } from "@/lib/hooks/useHabits";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useUhabitsExport } from "@/lib/hooks/useUhabitsExport";
import { useTodoistExport } from "@/lib/hooks/useTodoistExport";
import { useCalendarStore } from "@/lib/calendar/store";
import { downloadICS } from "@/lib/utils/ics-generator";
import { notify } from "@/lib/notify";
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

  const taskStr = taskCount === 1 ? "1 task" : `${taskCount} tasks`;

  if (projectCount === 0) {
    return taskStr;
  }

  const projectStr =
    projectCount === 1 ? "1 project" : `${projectCount} projects`;
  return `${taskStr} across ${projectStr}`;
}

export function formatCalendarSummary(eventCount: number): string {
  if (eventCount === 0) {
    return "No calendar events to export";
  }
  return eventCount === 1
    ? "1 event ready to export"
    : `${eventCount} events ready to export`;
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
  const [drillDown, setDrillDown] = useState<"loop-habits" | null>(null);

  const habitsQuery = useHabits();
  const tasksQuery = useTasks({ showCompleted: false });
  const projectsQuery = useProjects();
  const events = useCalendarStore((state) => state.events);

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
  const calendarSummary = formatCalendarSummary(events.length);

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

  const handleExportICS = () => {
    trigger("thud");
    try {
      downloadICS(events);
      notify.success("Calendar exported to .ics");
      trigger("success");
    } catch {
      notify.error("Failed to export calendar");
      trigger("thud");
    }
  };

  const handleDismissTip = () => {
    trigger("tick");
    setShowTodoistTip(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {drillDown === "loop-habits" ? (
        /* Dedicated Drill-down Sub-view */
        <div className="space-y-4 min-h-[260px]">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                trigger("tick");
                setDrillDown(null);
              }}
              className="h-7 px-2 -ml-1 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              aria-label="Back to all apps"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              Back
            </Button>
            <span className="text-xs font-medium text-foreground">
              Loop Habit Formats
            </span>
          </div>

          {/* Row 1: Database (.db) */}
          <div
            role="button"
            tabIndex={isExportingLoop ? -1 : 0}
            aria-disabled={isExportingLoop}
            aria-label="Export Loop Habit Tracker database"
            onClick={() => void runExport(exportLoopDb)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isExportingLoop) {
                e.preventDefault();
                void runExport(exportLoopDb);
              }
            }}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              isExportingLoop &&
                "pointer-events-none opacity-60 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium">Database (.db)</h3>
                <p className="text-xs text-muted-foreground lowercase">
                  Android Loop app backup
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0",
                isExportingLoop
                  ? "opacity-100"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
              )}
              disabled={isExportingLoop}
            >
              {isExportingLoop ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <FileDown className="h-4 w-4" strokeWidth={2.25} />
              )}
            </Button>
          </div>

          {/* Row 2: CSV Archive (.zip) */}
          <div
            role="button"
            tabIndex={isExportingLoop ? -1 : 0}
            aria-disabled={isExportingLoop}
            aria-label="Export Loop Habit Tracker CSV archive"
            onClick={() => void runExport(exportLoopZip)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isExportingLoop) {
                e.preventDefault();
                void runExport(exportLoopZip);
              }
            }}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              isExportingLoop &&
                "pointer-events-none opacity-60 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium">CSV Archive (.zip)</h3>
                <p className="text-xs text-muted-foreground lowercase">
                  Habits and checkmarks history
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0",
                isExportingLoop
                  ? "opacity-100"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
              )}
              disabled={isExportingLoop}
            >
              <FileDown className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 min-h-[260px]">
          {/* Calendar (ICS) Export Card */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Export Calendar to ICS"
            onClick={handleExportICS}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleExportICS();
              }
            }}
            className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-brand/10 text-brand shrink-0 flex items-center justify-center">
                <Calendar className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium flex items-center gap-1.5 truncate">
                  ICS (Calendar)
                </h3>
                <p className="text-xs text-muted-foreground lowercase mt-0.5 truncate">
                  {calendarSummary}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-hidden="true"
              className="h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <FileDown className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>

          {/* Loop Habit Tracker Card */}
          <div
            role="button"
            tabIndex={isExportingLoop ? -1 : 0}
            aria-disabled={isExportingLoop}
            aria-label="Export Loop Habit Tracker"
            onClick={() => {
              if (isExportingLoop) return;
              trigger("toggle");
              setDrillDown("loop-habits");
            }}
            onKeyDown={(e) => {
              if (isExportingLoop) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                trigger("toggle");
                setDrillDown("loop-habits");
              }
            }}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              isExportingLoop &&
                "pointer-events-none opacity-60 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium flex items-center gap-1.5 truncate">
                  Loop Habit Tracker
                  <BetaBadge />
                </h3>
                <p className="text-xs text-muted-foreground lowercase mt-0.5 truncate">
                  {habitSummary}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0",
                isExportingLoop
                  ? "opacity-100"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
              disabled={isExportingLoop}
            >
              {isExportingLoop ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
              )}
            </Button>
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
              "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              isExportingTodoist &&
                "pointer-events-none opacity-60 cursor-not-allowed",
            )}
            aria-label="Export Todoist ZIP archive"
          >
            <div className="flex items-center gap-3 min-w-0">
              <TodoistIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium flex items-center gap-1.5 truncate">
                  Todoist
                  <BetaBadge />
                </h3>
                <p className="text-xs text-muted-foreground lowercase mt-0.5 truncate">
                  {todoistSummary}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0",
                isExportingTodoist
                  ? "opacity-100"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
              )}
              disabled={isExportingTodoist}
            >
              {isExportingTodoist ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <FileDown className="h-4 w-4" strokeWidth={2.25} />
              )}
            </Button>
          </div>
        </div>
      )}

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
