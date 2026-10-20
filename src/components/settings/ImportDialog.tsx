"use client";

import { useRef, type SVGProps } from "react";
import { format } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Loader2, Calendar, FileUp } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { useIcsImport, ICS_CONFIRM_THRESHOLD } from "@/lib/hooks/useIcsImport";
import { useTodoistImport } from "@/lib/hooks/useTodoistImport";
import {
  isArchivePreview,
  type TodoistProjectStatus,
} from "@/lib/import/todoist/plan";
import { cn } from "@/lib/utils";

function LoopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 484 484"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="242" cy="242" r="240" fill="#1976D2" />
      <path
        fill="#ffffff"
        d="M209,101.5c6,3.1 6,3.2 6,50.7 0,41.1 -0.1,43.4 -1.9,46.2 -2.5,3.7 -5.7,5.5 -9.8,5.6 -3.8,-0 -7,-2.6 -22.1,-18l-10.4,-10.5 -2.4,3c-23.6,28.6 -28.4,67.7 -12.3,99.7 12.2,24.2 34.2,42 59.9,48.4 10.5,2.7 33.5,2.6 44,-0 32,-8 58.6,-34.6 66.6,-66.6 2.9,-11.4 2.6,-34.6 -0.4,-45.9 -4.9,-17.9 -14.7,-33 -30.5,-46.9 -6.4,-5.6 -5.7,-7.3 9.1,-21.8 14.7,-14.5 16.3,-15.8 19.2,-14.9 2.8,0.9 17.6,15.7 22.9,22.9 13.1,17.7 21.6,36.1 25.9,56 2.2,10.3 2.6,14.6 2.6,28.6 0,23.7 -3.4,38.8 -13.4,59.5 -7.2,15.1 -14.2,24.8 -27,37.5 -12.7,12.8 -22.4,19.8 -37.5,27 -20.5,9.9 -35.8,13.3 -59,13.4 -18.2,-0 -27.7,-1.5 -44.5,-7 -40.2,-13.3 -73.8,-47.1 -87,-87.4 -14.1,-43 -6.2,-89.6 21.2,-126 3.1,-4.2 6.6,-8.4 7.8,-9.5l2.1,-1.9 -12.7,-12.7c-12.3,-12.3 -12.7,-12.8 -13.2,-17.7 -0.5,-5.8 0.7,-8.6 5.1,-11.2 3,-1.9 5.4,-2 46,-2 36.3,-0 43.2,0.2 45.7,1.5z"
      />
    </svg>
  );
}

function TodoistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 0h24c2.2 0 4 1.8 4 4v24c0 2.2-1.8 4-4 4H4c-2.2 0-4-1.8-4-4v-5.374l.057.033c1.365.794 4.592 2.674 5.382 3.12.478.27.936.263 1.397-.003l6.328-3.641.012-.007.035-.02 6.575-3.784c.277-.16.291-.652-.02-.829l-.217-.124c-.316-.18-.726-.413-.901-.516a1.02 1.02 0 0 0-.998.012c-.154.09-10.5 6.038-10.847 6.235a1.349 1.349 0 0 1-1.338 0L0 19.927v-2.693l.057.033c1.365.795 4.592 2.674 5.382 3.12.478.27.936.264 1.397-.002.276-.16 3.307-1.903 6.367-3.664l.024-.014 6.559-3.775c.277-.16.291-.651-.02-.828l-.217-.124c-.316-.18-.726-.414-.901-.517a1.02 1.02 0 0 0-.998.012c-.154.09-10.5 6.039-10.847 6.235a1.349 1.349 0 0 1-1.338 0L0 14.535v-2.693l.056.033a943.17 943.17 0 0 0 5.383 3.12c.478.27.936.264 1.397-.002l6.374-3.668.008-.005c3.2-1.84 6.426-3.698 6.568-3.78.277-.16.291-.65-.02-.828l-.217-.124c-.317-.18-.727-.414-.901-.516a1.02 1.02 0 0 0-.998.012c-.154.089-10.5 6.038-10.847 6.235a1.349 1.349 0 0 1-1.338 0L0 9.143V4c0-2.2 1.8-4 4-4Z"
        fill="#E44232"
      />
      <path
        d="M6.836 14.993c.276-.16 3.311-1.906 6.374-3.668l.008-.005c3.2-1.84 6.426-3.698 6.568-3.78.277-.16.29-.65-.02-.828l-.217-.124c-.316-.18-.727-.414-.902-.516a1.02 1.02 0 0 0-.997.012c-.155.089-10.501 6.038-10.847 6.235a1.349 1.349 0 0 1-1.339 0L0 9.143v2.698l.056.033c1.364.795 4.592 2.674 5.383 3.12.478.27.936.264 1.397-.002Z"
        fill="#ffffff"
      />
      <path
        d="m6.836 20.385 6.366-3.664.024-.014 6.56-3.775c.277-.16.29-.651-.02-.828l-.217-.124c-.316-.18-.727-.414-.902-.517a1.02 1.02 0 0 0-.997.012c-.155.09-10.501 6.039-10.847 6.235a1.349 1.349 0 0 1-1.339 0L0 14.535v2.699l.057.033c1.365.795 4.591 2.674 5.382 3.12.478.27.936.264 1.397-.002Z"
        fill="#ffffff"
      />
      <path
        d="m13.21 22.108-6.374 3.668c-.461.266-.919.273-1.397.003-.79-.446-4.018-2.326-5.382-3.12L0 22.626v-2.699l5.464 3.175c.413.238.925.235 1.339 0 .346-.197 10.692-6.146 10.847-6.235a1.02 1.02 0 0 1 .997-.012c.175.103.586.336.902.516l.218.124c.31.177.296.669.019.829l-6.575 3.784Z"
        fill="#ffffff"
      />
    </svg>
  );
}

const TODOIST_PROJECT_STATUS_LABELS: Record<TodoistProjectStatus, string> = {
  inbox: "Inbox",
  merged: "Merge",
  new: "New",
};

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const todoistInputRef = useRef<HTMLInputElement>(null);
  const { trigger } = useHaptic();

  const { importUhabits, isImporting: isImportingUhabits } = useUhabitsImport();
  const {
    prepareImport,
    commitImport,
    cancelImport,
    preview,
    isImporting: isImportingIcs,
  } = useIcsImport();
  const {
    prepareImport: prepareTodoistImport,
    commitImport: commitTodoistImport,
    cancelImport: cancelTodoistImport,
    preview: todoistPreview,
    isImporting: isImportingTodoist,
  } = useTodoistImport();

  const handleImportUhabits = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const success = await importUhabits(file);
    if (success) onOpenChange(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportIcs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await prepareImport(file);
    if (icsInputRef.current) icsInputRef.current.value = "";
    if (!result) return;
    if (result.toCreate.length < ICS_CONFIRM_THRESHOLD) {
      const success = await commitImport(result);
      if (success) onOpenChange(false);
    }
  };

  const handleConfirmIcsImport = async () => {
    trigger("toggle");
    const success = await commitImport();
    if (success) onOpenChange(false);
  };

  const handleCancelIcsImport = () => {
    trigger("tick");
    cancelImport();
  };

  const processTodoistFile = async (file: File) => {
    await prepareTodoistImport(file);
    if (todoistInputRef.current) todoistInputRef.current.value = "";
  };

  const handleImportTodoist = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processTodoistFile(file);
  };

  const handleConfirmTodoistImport = async () => {
    trigger("toggle");
    const success = await commitTodoistImport();
    if (success) onOpenChange(false);
  };

  const handleCancelTodoistImport = () => {
    trigger("tick");
    cancelTodoistImport();
  };

  const isAnyImporting =
    isImportingUhabits || isImportingIcs || isImportingTodoist;

  if (todoistPreview) {
    const isArchive = isArchivePreview(todoistPreview);
    const dateRange =
      todoistPreview.earliestDate && todoistPreview.latestDate
        ? todoistPreview.earliestDate === todoistPreview.latestDate
          ? format(new Date(todoistPreview.earliestDate), "MMM d, yyyy")
          : `${format(new Date(todoistPreview.earliestDate), "MMM d, yyyy")} – ${format(new Date(todoistPreview.latestDate), "MMM d, yyyy")}`
        : null;

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelTodoistImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="type-h2">
              Confirm Todoist Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Review detected tasks before importing into Kagelin.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="px-4 py-4 sm:px-0">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total tasks found</dt>
                <dd className="font-medium">{todoistPreview.totalTasks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Top-level tasks</dt>
                <dd>{todoistPreview.rootTasksCount}</dd>
              </div>
              {todoistPreview.subtasksCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Steps</dt>
                  <dd>{todoistPreview.subtasksCount}</dd>
                </div>
              )}
              {todoistPreview.recurringCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Recurring tasks</dt>
                  <dd>{todoistPreview.recurringCount}</dd>
                </div>
              )}
              {dateRange && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Scheduled range</dt>
                  <dd>{dateRange}</dd>
                </div>
              )}
              {isArchive && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Projects detected</dt>
                    <dd>{todoistPreview.projects.length}</dd>
                  </div>
                  {todoistPreview.newProjectCount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">New projects</dt>
                      <dd>{todoistPreview.newProjectCount}</dd>
                    </div>
                  )}
                  {todoistPreview.mergedProjectCount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Merged into existing
                      </dt>
                      <dd>{todoistPreview.mergedProjectCount}</dd>
                    </div>
                  )}
                  {todoistPreview.duplicateTasksSkipped > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Duplicates skipped
                      </dt>
                      <dd>{todoistPreview.duplicateTasksSkipped}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {isArchive && todoistPreview.projects.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Detected projects
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {todoistPreview.projects.map((project) => (
                    <li
                      key={`${project.status}:${project.name}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{project.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {TODOIST_PROJECT_STATUS_LABELS[project.status]} ·{" "}
                        {project.tasks.length} tasks
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Note: Todoist automated exports only contain active tasks and
              exclude completed tasks.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={handleCancelTodoistImport}
              className="text-muted-foreground hover:text-foreground"
              disabled={isImportingTodoist}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTodoistImport}
              disabled={isImportingTodoist}
            >
              {isImportingTodoist ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Import ${todoistPreview.totalTasks} tasks`
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  if (preview) {
    const dateRange =
      preview.earliest && preview.latest
        ? preview.earliest === preview.latest
          ? format(new Date(preview.earliest), "MMM d, yyyy")
          : `${format(new Date(preview.earliest), "MMM d, yyyy")} – ${format(new Date(preview.latest), "MMM d, yyyy")}`
        : null;

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="type-h2">
              Confirm Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              This is a large import — review before adding it to your calendar.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="px-4 py-4 sm:px-0">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Events found</dt>
                <dd>{preview.totalParsed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">New events</dt>
                <dd>{preview.toCreate.length}</dd>
              </div>
              {preview.duplicateCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duplicates skipped</dt>
                  <dd>{preview.duplicateCount}</dd>
                </div>
              )}
              {dateRange && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date range</dt>
                  <dd>{dateRange}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={handleCancelIcsImport}
              className="text-muted-foreground hover:text-foreground"
              disabled={isImportingIcs}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmIcsImport} disabled={isImportingIcs}>
              {isImportingIcs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Import ${preview.toCreate.length} events`
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="type-h2">
            Import Data
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a file to migrate your data to Kagelin.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-4 py-4 sm:px-0">
          <div className="space-y-4">
            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                icsInputRef.current?.click();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-brand/10 text-brand shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">ICS (Calendar)</p>
                  <p className="text-xs text-muted-foreground lowercase">
                    Import to Calendar
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 transition-opacity text-brand",
                  isImportingIcs
                    ? "opacity-100"
                    : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                )}
                disabled={isAnyImporting}
                aria-label="Select iCalendar ICS file"
              >
                {isImportingIcs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={icsInputRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                aria-label="Upload iCalendar ICS file"
                onChange={handleImportIcs}
              />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                fileInputRef.current?.click();
              }}
            >
              <div className="flex items-center gap-3">
                <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    Loop Habit Tracker
                    <BetaBadge />
                  </p>
                  <p className="text-xs text-muted-foreground lowercase">
                    Import from .db file (Android)
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 transition-opacity text-brand",
                  isImportingUhabits
                    ? "opacity-100"
                    : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                )}
                disabled={isAnyImporting}
                aria-label="Select Loop Habit Tracker database file"
              >
                {isImportingUhabits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                className="hidden"
                aria-label="Upload Loop Habit Tracker database file"
                onChange={handleImportUhabits}
              />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                todoistInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  trigger("toggle");
                  void processTodoistFile(file);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <TodoistIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    Todoist
                    <BetaBadge />
                  </p>
                  <p className="text-xs text-muted-foreground lowercase">
                    Import tasks from CSV or ZIP backup
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 transition-opacity text-brand",
                  isImportingTodoist
                    ? "opacity-100"
                    : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                )}
                disabled={isAnyImporting}
                aria-label="Select Todoist CSV or ZIP backup file"
              >
                {isImportingTodoist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={todoistInputRef}
                type="file"
                accept=".csv,.zip,text/csv,application/zip"
                className="hidden"
                aria-label="Upload Todoist CSV or ZIP backup file"
                onChange={handleImportTodoist}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            disabled={isAnyImporting}
          >
            Cancel
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
