"use client";

import { useRef, useState, useId } from "react";
import { ArrowLeft, FileUp, Link2, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAuth } from "@/components/AuthProvider";
import { MicrosoftTasksGlyph } from "@/components/settings/MigrationIcons";
import type { MicrosoftTasksImportPreview } from "@/lib/import/microsoft-tasks/types";
import type { MicrosoftTasksImportState } from "@/lib/hooks/useMicrosoftTasksImport";
import { cn } from "@/lib/utils";

export interface MicrosoftTasksMigrationViewProps {
  onBack?: () => void;
  preview?: MicrosoftTasksImportPreview | null;
  state?: MicrosoftTasksImportState;
  isImporting?: boolean;
  isGuestMode?: boolean;
  onConnectOAuth?: () => void | Promise<unknown>;
  onFileSelect?: (file: File) => void | Promise<unknown>;
  onCommit?: (options?: {
    includeCompleted?: boolean;
  }) => void | Promise<unknown>;
  onCancel?: () => void;
  includeCompleted?: boolean;
  onIncludeCompletedChange?: (include: boolean) => void;
}

export function MicrosoftTasksMigrationView({
  onBack,
  preview: externalPreview,
  state: externalState,
  isImporting: externalIsImporting,
  isGuestMode: externalIsGuestMode,
  onConnectOAuth,
  onFileSelect,
  onCommit,
  onCancel,
  includeCompleted: externalIncludeCompleted,
  onIncludeCompletedChange,
}: MicrosoftTasksMigrationViewProps) {
  const { isGuestMode: authGuestMode } = useAuth();
  const { trigger } = useHaptic();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalIncludeCompleted, setInternalIncludeCompleted] =
    useState(true);

  const checkboxId = useId();

  const isGuestMode = externalIsGuestMode ?? authGuestMode;
  const preview = externalPreview ?? null;
  const state = externalState ?? "idle";
  const isImporting = externalIsImporting ?? false;
  const includeCompleted = externalIncludeCompleted ?? internalIncludeCompleted;

  const handleIncludeCompletedToggle = (checked: boolean) => {
    setInternalIncludeCompleted(checked);
    onIncludeCompletedChange?.(checked);
  };

  const handleConnect = async () => {
    trigger("toggle");
    await onConnectOAuth?.();
  };

  const processFile = async (file: File) => {
    trigger("toggle");
    await onFileSelect?.(file);
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    trigger("tick");
    onCancel?.();
  };

  const handleCommit = async () => {
    trigger("toggle");
    await onCommit?.({ includeCompleted });
  };

  // Preview Mode
  if (preview) {
    const completedTasksCount = preview.totalCompleted;
    const importableTasksCount = includeCompleted
      ? preview.totalTasks
      : preview.totalTasks - completedTasksCount;

    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
        <div className="shrink-0 text-left pb-3">
          <div className="flex items-center gap-2 mb-1">
            <MicrosoftTasksGlyph className="h-6 w-6 shrink-0 rounded-md shadow-xs" />
            <h2 className="type-h2 text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Confirm Microsoft To Do Import
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Review detected lists, tasks, and steps before importing into
            Kagelin.
          </p>
        </div>

        {/* Live Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-3 shrink-0">
          <div className="flex flex-col p-2 rounded-lg bg-secondary/20 border border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">
              Total Lists
            </span>
            <span className="text-sm font-semibold text-foreground">
              {preview.totalLists}
            </span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-secondary/20 border border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">
              Total Tasks
            </span>
            <span className="text-sm font-semibold text-foreground">
              {preview.totalTasks}
            </span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-secondary/20 border border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">
              Total Steps
            </span>
            <span className="text-sm font-semibold text-foreground">
              {preview.subtasksCount}
            </span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-secondary/20 border border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">Completed</span>
            <span className="text-sm font-semibold text-foreground">
              {preview.totalCompleted}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-col p-2 rounded-lg bg-secondary/20 border border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">
              Skipped Duplicates
            </span>
            <span className="text-sm font-semibold text-foreground">
              {preview.duplicatesCount}
            </span>
          </div>
        </div>

        {/* Scroll-contained hierarchy list */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 rounded-xl border border-border/40 bg-secondary/10 space-y-3">
          {preview.projects.map((proj) => {
            const rootTasks = proj.tasks.filter((t) => !t.tempParentId);
            const stepTasks = proj.tasks.filter((t) => Boolean(t.tempParentId));

            return (
              <div key={proj.listId} className="space-y-1.5 text-left">
                <div className="flex items-center justify-between text-xs font-medium text-foreground pb-1 border-b border-border/30">
                  <span className="truncate flex items-center gap-1.5">
                    <span className="font-semibold">{proj.name}</span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground">
                      {proj.status === "inbox"
                        ? "Inbox"
                        : proj.status === "merged"
                          ? "Merge"
                          : "New"}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground text-[11px]">
                    {rootTasks.length}{" "}
                    {rootTasks.length === 1 ? "task" : "tasks"}
                    {stepTasks.length > 0 && ` · ${stepTasks.length} steps`}
                  </span>
                </div>

                <ul className="space-y-1 pl-1 text-xs">
                  {rootTasks.map((task) => {
                    // Match checklist steps for this task
                    const childSteps = stepTasks.filter(
                      (s) =>
                        s.parentId === task.id ||
                        s.tempParentId === task.tempId,
                    );

                    return (
                      <li key={task.tempId} className="space-y-0.5">
                        <div className="flex items-center gap-2 text-foreground">
                          {task.isCompleted ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                              strokeWidth={2.25}
                            />
                          ) : (
                            <span className="h-2 w-2 rounded-full border border-muted-foreground/60 shrink-0 ml-0.5 mr-1" />
                          )}
                          <span
                            className={cn(
                              "truncate",
                              task.isCompleted &&
                                "line-through text-muted-foreground",
                            )}
                          >
                            {task.content}
                          </span>
                        </div>

                        {childSteps.length > 0 && (
                          <ul className="pl-5 space-y-0.5 border-l border-border/30 ml-2">
                            {childSteps.map((step) => (
                              <li
                                key={step.tempId}
                                className="flex items-center gap-1.5 text-muted-foreground text-[11px]"
                              >
                                <span className="text-muted-foreground/50">
                                  ↳
                                </span>
                                <span
                                  className={cn(
                                    "truncate",
                                    step.isCompleted && "line-through",
                                  )}
                                >
                                  {step.content}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}

                  {/* Steps redirected to pre-existing workspace tasks */}
                  {stepTasks
                    .filter(
                      (s) =>
                        !rootTasks.some(
                          (t) =>
                            t.id === s.parentId || t.tempId === s.tempParentId,
                        ),
                    )
                    .map((step) => (
                      <li
                        key={step.tempId}
                        className="flex items-center gap-1.5 text-muted-foreground text-[11px] pl-2"
                      >
                        <span className="text-muted-foreground/60">
                          ↳ [Existing Task]
                        </span>
                        <span
                          className={cn(
                            "truncate",
                            step.isCompleted && "line-through",
                          )}
                        >
                          {step.content}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Include completed checkbox */}
        {completedTasksCount > 0 && (
          <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-2 shrink-0">
            <label
              htmlFor={checkboxId}
              className="cursor-pointer text-xs text-muted-foreground select-none"
            >
              Include completed tasks ({completedTasksCount})
            </label>
            <input
              id={checkboxId}
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => handleIncludeCompletedToggle(e.target.checked)}
              className="h-4 w-4 rounded border-border"
              disabled={isImporting}
            />
          </div>
        )}

        {/* Chunked progress indicator */}
        {isImporting && (
          <div
            className="space-y-1.5 pt-2 shrink-0"
            role="progressbar"
            aria-label="Importing tasks"
          >
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Importing records in chunks of 100...</span>
              <span className="animate-pulse motion-reduce:animate-none">
                Processing
              </span>
            </div>
            <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
              <div className="bg-brand h-full animate-pulse motion-reduce:animate-none w-full" />
            </div>
          </div>
        )}

        {/* Commit and Cancel Controls */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0 mt-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleCommit()}
            disabled={isImporting}
            className="text-xs h-8"
          >
            {isImporting ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={2.25}
              />
            ) : (
              `Import ${importableTasksCount} tasks`
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Drill-down Subview (Ingress options)
  return (
    <div className="space-y-4 min-h-[340px] text-left">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              trigger("tick");
              onBack();
            }}
            className="h-7 px-2 -ml-1 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            aria-label="Back to all apps"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Back
          </Button>
        )}
        <span className="text-xs font-medium text-foreground">
          Microsoft To Do Import
        </span>
      </div>

      {/* Row 1: Direct OAuth (1-Click Connect & Import) */}
      {!isGuestMode && (
        <div
          role="button"
          tabIndex={isImporting ? -1 : 0}
          aria-disabled={isImporting}
          aria-label="Connect Microsoft To Do"
          onClick={() => void handleConnect()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isImporting) {
              e.preventDefault();
              void handleConnect();
            }
          }}
          className={cn(
            "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
            isImporting && "opacity-60 cursor-not-allowed pointer-events-none",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <MicrosoftTasksGlyph className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                Connect Microsoft Account
                <BetaBadge />
              </p>
              <p className="text-xs text-muted-foreground lowercase truncate">
                1-Click Direct OAuth automated sync
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            aria-hidden="true"
            className="h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            disabled={isImporting}
          >
            {isImporting && state === "fetching" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Link2 className="h-4 w-4" strokeWidth={2.25} />
            )}
          </Button>
        </div>
      )}

      {/* Row 2: File Drop Zone (.json and .csv) */}
      <div
        role="button"
        tabIndex={isImporting ? -1 : 0}
        aria-disabled={isImporting}
        aria-label="Import Microsoft Tasks JSON or Outlook CSV file"
        onClick={(e) => {
          if (isImporting || e.target === fileInputRef.current) return;
          trigger("toggle");
          fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (isImporting) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            trigger("toggle");
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            void processFile(file);
          }
        }}
        className={cn(
          "flex flex-col gap-2 p-4 rounded-xl border transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          isDragOver
            ? "border-brand bg-brand/5"
            : "border-border/40 bg-secondary/10 hover:bg-secondary/20",
          isImporting && "opacity-60 cursor-not-allowed pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 min-w-0">
            <MicrosoftTasksGlyph className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                File Upload (.json or .csv)
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Drop Graph Tasks JSON or Classic Outlook CSV
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            aria-hidden="true"
            className="h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            disabled={isImporting}
          >
            {isImporting && state === "fetching" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <FileUp className="h-4 w-4" strokeWidth={2.25} />
            )}
          </Button>
        </div>

        {/* Clear disclosure regarding CSV steps limitation */}
        <p className="text-[11px] text-muted-foreground/80 pl-12 pr-2">
          Note: Classic Outlook CSV exports do not contain checklist Steps. Use
          Microsoft Graph JSON for full fidelity checklist import.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json,.csv,text/csv"
          className="hidden"
          aria-label="Upload Microsoft Tasks file"
          onClick={(e) => e.stopPropagation()}
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
}
