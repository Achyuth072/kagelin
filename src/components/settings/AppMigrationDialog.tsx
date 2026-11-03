"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import {
  Loader2,
  Calendar,
  FileUp,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { useIcsImport, ICS_CONFIRM_THRESHOLD } from "@/lib/hooks/useIcsImport";
import { useTodoistImport } from "@/lib/hooks/useTodoistImport";
import {
  isArchivePreview,
  type TodoistProjectStatus,
} from "@/lib/import/todoist/plan";
import { cn } from "@/lib/utils";
import { LoopIcon, TodoistIcon } from "@/components/settings/MigrationIcons";
import { MigrationExportTab } from "@/components/settings/MigrationExportTab";

const TODOIST_PROJECT_STATUS_LABELS: Record<TodoistProjectStatus, string> = {
  inbox: "Inbox",
  merged: "Merge",
  new: "New",
};

export interface AppMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "import" | "export";
}

export function AppMigrationDialog({
  open,
  onOpenChange,
  defaultTab = "import",
}: AppMigrationDialogProps) {
  const [activeTab, setActiveTab] = useState<"import" | "export">(defaultTab);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const todoistInputRef = useRef<HTMLInputElement>(null);
  const { trigger } = useHaptic();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setActiveTab(defaultTab);
    setPrevOpen(open);
  } else if (!open && prevOpen) {
    setPrevOpen(open);
  }

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

  const handleTabChange = (val: string) => {
    trigger("toggle");
    setActiveTab(val as "import" | "export");
  };

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
                  {todoistPreview.subtasksReassigned > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Steps re-attached to matching tasks
                      </dt>
                      <dd>{todoistPreview.subtasksReassigned}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {isArchive && todoistPreview.failedFiles.length > 0 && (
              <div className="mt-4 rounded-lg border border-destructive-surface-border bg-destructive-surface p-3.5">
                <p className="text-xs font-medium text-destructive-surface-foreground">
                  {todoistPreview.failedFiles.length} file(s) in the backup
                  could not be parsed and will be skipped
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-destructive-surface-foreground">
                  {todoistPreview.failedFiles.map((failure) => (
                    <li key={failure.fileName}>
                      <span className="font-medium">{failure.fileName}</span>
                      <span className="block opacity-80">
                        {failure.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            App Migration
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Import data from or export data to other productivity apps.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-4 py-4 sm:px-0">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList size="lg" className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger
                value="import"
                className="h-full px-2"
                aria-label="Import from other apps"
              >
                <ArrowDownToLine aria-hidden="true" />
                <span className="truncate">Import</span>
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="h-full px-2"
                aria-label="Export to other apps"
              >
                <ArrowUpFromLine aria-hidden="true" />
                <span className="truncate">Export</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4 m-0">
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
            </TabsContent>

            <TabsContent value="export" className="m-0">
              <MigrationExportTab />
            </TabsContent>
          </Tabs>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// Backwards compatibility re-export
export { AppMigrationDialog as ImportDialog };
export type { AppMigrationDialogProps as ImportDialogProps };
