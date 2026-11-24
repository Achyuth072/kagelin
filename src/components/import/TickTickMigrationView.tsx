"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TickTickImportPreview } from "@/lib/import/ticktick/types";

function formatDateRange(
  earliest: string | null | undefined,
  latest: string | null | undefined,
): string | null {
  if (!earliest || !latest) return null;
  const parseCalendarDate = (isoStr: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    return new Date(isoStr);
  };
  const start = parseCalendarDate(earliest);
  const end = parseCalendarDate(latest);
  const now = new Date();
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year:
      start.getFullYear() !== now.getFullYear() ||
      end.getFullYear() !== now.getFullYear()
        ? "numeric"
        : undefined,
  };
  return `${start.toLocaleDateString(undefined, formatOptions)} – ${end.toLocaleDateString(undefined, formatOptions)}`;
}

export interface TickTickMigrationViewProps {
  preview: TickTickImportPreview;
  isImporting?: boolean;
  includeCompleted?: boolean;
  onIncludeCompletedChange?: (include: boolean) => void;
  onCommit: () => void | Promise<unknown>;
  onCancel: () => void;
}

export function TickTickMigrationView({
  preview,
  isImporting = false,
  includeCompleted: externalIncludeCompleted,
  onIncludeCompletedChange,
  onCommit,
  onCancel,
}: TickTickMigrationViewProps) {
  const checkboxId = useId();
  const [internalIncludeCompleted, setInternalIncludeCompleted] =
    useState(true);

  const includeCompleted = externalIncludeCompleted ?? internalIncludeCompleted;

  const handleIncludeCompletedChange = (checked: boolean) => {
    setInternalIncludeCompleted(checked);
    onIncludeCompletedChange?.(checked);
  };

  const completedTasksCount = preview.completedTasksCount;
  const importableTasksCount = includeCompleted
    ? preview.totalTasks
    : preview.totalTasks - completedTasksCount;

  const dateRange = formatDateRange(preview.earliestDate, preview.latestDate);

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      <div className="p-4 sm:p-6 pb-2 shrink-0 text-left">
        <h2 className="type-h2">Confirm TickTick Import</h2>
        <p className="text-sm text-muted-foreground">
          Review detected tasks before importing into Kagelin.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-2">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total tasks found</dt>
            <dd className="font-medium">{preview.totalTasks}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Top-level tasks</dt>
            <dd>{preview.rootTasksCount}</dd>
          </div>
          {preview.subtasksCount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Steps</dt>
              <dd>{preview.subtasksCount}</dd>
            </div>
          )}
          {preview.recurringCount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Recurring tasks</dt>
              <dd>{preview.recurringCount}</dd>
            </div>
          )}
          {completedTasksCount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Completed tasks</dt>
              <dd>{completedTasksCount}</dd>
            </div>
          )}
          {preview.duplicateTasksSkipped > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Duplicates skipped</dt>
              <dd>{preview.duplicateTasksSkipped}</dd>
            </div>
          )}
          {preview.subtasksReassigned > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Steps re-attached to existing tasks
              </dt>
              <dd>{preview.subtasksReassigned}</dd>
            </div>
          )}
          {dateRange && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Scheduled range</dt>
              <dd>{dateRange}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Projects detected</dt>
            <dd>{preview.projects.length}</dd>
          </div>
          {preview.newProjectCount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">New projects</dt>
              <dd>{preview.newProjectCount}</dd>
            </div>
          )}
          {preview.mergedProjectCount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Merged into existing</dt>
              <dd>{preview.mergedProjectCount}</dd>
            </div>
          )}
          {completedTasksCount > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-2">
              <label
                htmlFor={checkboxId}
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Include completed tasks ({completedTasksCount})
              </label>
              <input
                id={checkboxId}
                type="checkbox"
                checked={includeCompleted}
                onChange={(e) => handleIncludeCompletedChange(e.target.checked)}
                className="h-4 w-4 rounded border-border"
                disabled={isImporting}
              />
            </div>
          )}
        </dl>

        {preview.projects.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Detected projects
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {preview.projects.map((project) => (
                <li
                  key={`${project.status}:${project.name}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{project.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {project.status === "inbox"
                      ? "Inbox"
                      : project.status === "merged"
                        ? "Merge"
                        : "New"}{" "}
                    · {project.tasks.length} tasks
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-4 sm:p-6 pt-2 border-t border-border/40 shrink-0">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
        <Button onClick={onCommit} disabled={isImporting}>
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          ) : (
            `Import ${importableTasksCount} tasks`
          )}
        </Button>
      </div>
    </div>
  );
}
