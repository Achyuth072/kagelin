"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Link2,
  ArrowLeft,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAuth } from "@/components/AuthProvider";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { useIcsImport, ICS_CONFIRM_THRESHOLD } from "@/lib/hooks/useIcsImport";
import { useGoogleTasksImport } from "@/lib/hooks/useGoogleTasksImport";
import { useMicrosoftTasksImport } from "@/lib/hooks/useMicrosoftTasksImport";
import { useTickTickImport } from "@/lib/hooks/useTickTickImport";
import { useTodoistImport } from "@/lib/hooks/useTodoistImport";
import { MicrosoftTasksMigrationView } from "@/components/import/MicrosoftTasksMigrationView";
import { TickTickMigrationView } from "@/components/import/TickTickMigrationView";
import {
  isArchivePreview,
  type TodoistProjectStatus,
} from "@/lib/import/todoist/plan";
import { cn } from "@/lib/utils";
import {
  LoopIcon,
  GoogleTasksIcon,
  MicrosoftTasksGlyph,
  TickTickIcon,
  TodoistIcon,
} from "@/components/settings/MigrationIcons";
import { MigrationExportTab } from "@/components/settings/MigrationExportTab";

const TODOIST_PROJECT_STATUS_LABELS: Record<TodoistProjectStatus, string> = {
  inbox: "Inbox",
  merged: "Merge",
  new: "New",
};

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
  const d1 = parseCalendarDate(earliest);
  const d2 = parseCalendarDate(latest);
  const f1 = format(d1, "MMM d, yyyy");
  const f2 = format(d2, "MMM d, yyyy");
  return f1 === f2 ? f1 : `${f1} – ${f2}`;
}

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
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"import" | "export">(defaultTab);
  const [googleTasksDrillDown, setGoogleTasksDrillDown] = useState(false);
  const [microsoftTasksDrillDown, setMicrosoftTasksDrillDown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const todoistInputRef = useRef<HTMLInputElement>(null);
  const googleTasksInputRef = useRef<HTMLInputElement>(null);
  const tickTickInputRef = useRef<HTMLInputElement>(null);
  const [includeCompletedTickTick, setIncludeCompletedTickTick] =
    useState(true);
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setActiveTab(defaultTab);
    setGoogleTasksDrillDown(false);
    setMicrosoftTasksDrillDown(false);
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
  const {
    prepareOAuthImport,
    prepareTakeoutImport,
    commitImport: commitGoogleTasksImport,
    cancelImport: cancelGoogleTasksImport,
    preview: googleTasksPreview,
    isImporting: isImportingGoogleTasks,
  } = useGoogleTasksImport();
  const {
    prepareOAuthImport: prepareMicrosoftOAuthImport,
    prepareFileImport: prepareMicrosoftFileImport,
    commitImport: commitMicrosoftTasksImport,
    cancelImport: cancelMicrosoftTasksImport,
    preview: microsoftTasksPreview,
    state: microsoftTasksState,
    isImporting: isImportingMicrosoftTasks,
  } = useMicrosoftTasksImport();
  const {
    prepareImport: prepareTickTickImport,
    commitImport: commitTickTickImport,
    cancelImport: cancelTickTickImport,
    preview: tickTickPreview,
    isImporting: isImportingTickTick,
  } = useTickTickImport();

  const handleTabChange = (val: string) => {
    trigger("toggle");
    setGoogleTasksDrillDown(false);
    setMicrosoftTasksDrillDown(false);
    setActiveTab(val as "import" | "export");
  };

  const processUhabitsFile = async (file: File) => {
    const success = await importUhabits(file);
    if (success) {
      onOpenChange(false);
      router.push("/habits");
    }
  };

  const handleImportUhabits = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUhabitsFile(file);
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
      if (success) {
        onOpenChange(false);
        router.push("/calendar");
      }
    }
  };

  const handleConfirmIcsImport = async () => {
    trigger("toggle");
    const success = await commitImport();
    if (success) {
      onOpenChange(false);
      router.push("/calendar");
    }
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
    if (success) {
      onOpenChange(false);
      router.push("/?project=all");
    }
  };

  const handleCancelTodoistImport = () => {
    trigger("tick");
    cancelTodoistImport();
  };

  const handleConnectGoogleTasks = async () => {
    if (isGuestMode || isAnyImporting) return;
    trigger("toggle");
    await prepareOAuthImport();
  };

  const processGoogleTasksFile = async (file: File) => {
    await prepareTakeoutImport(file);
    if (googleTasksInputRef.current) googleTasksInputRef.current.value = "";
  };

  const handleImportGoogleTasksTakeout = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processGoogleTasksFile(file);
  };

  const [includeCompletedGoogleTasks, setIncludeCompletedGoogleTasks] =
    useState(true);

  const handleConfirmGoogleTasksImport = async () => {
    trigger("toggle");
    const success = await commitGoogleTasksImport(undefined, {
      includeCompleted: includeCompletedGoogleTasks,
    });
    if (success) {
      onOpenChange(false);
      router.push("/?project=all");
    }
  };

  const handleCancelGoogleTasksImport = () => {
    trigger("tick");
    cancelGoogleTasksImport();
  };

  const processTickTickFile = async (file: File) => {
    await prepareTickTickImport(file);
    if (tickTickInputRef.current) tickTickInputRef.current.value = "";
  };

  const handleImportTickTick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processTickTickFile(file);
  };

  const handleConfirmTickTickImport = async () => {
    trigger("toggle");
    const success = await commitTickTickImport({
      includeCompleted: includeCompletedTickTick,
    });
    if (success) {
      onOpenChange(false);
      router.push("/?project=all");
    }
  };

  const handleCancelTickTickImport = () => {
    trigger("tick");
    cancelTickTickImport();
  };

  useEffect(() => {
    if (googleTasksPreview && !open) {
      onOpenChange(true);
    }
  }, [googleTasksPreview, open, onOpenChange]);

  useEffect(() => {
    if (microsoftTasksPreview && !open) {
      onOpenChange(true);
    }
  }, [microsoftTasksPreview, open, onOpenChange]);

  useEffect(() => {
    if (tickTickPreview && !open) {
      onOpenChange(true);
    }
  }, [tickTickPreview, open, onOpenChange]);

  const isAnyImporting =
    isImportingUhabits ||
    isImportingIcs ||
    isImportingTodoist ||
    isImportingGoogleTasks ||
    isImportingMicrosoftTasks ||
    isImportingTickTick;

  if (microsoftTasksPreview) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelMicrosoftTasksImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[480px] p-4 sm:p-6 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <MicrosoftTasksMigrationView
            preview={microsoftTasksPreview}
            state={microsoftTasksState}
            isImporting={isImportingMicrosoftTasks}
            onCommit={async (opts) => {
              const success = await commitMicrosoftTasksImport(
                microsoftTasksPreview,
                opts,
              );
              if (success) {
                onOpenChange(false);
              }
            }}
            onCancel={() => {
              cancelMicrosoftTasksImport();
              onOpenChange(false);
            }}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  if (tickTickPreview) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleCancelTickTickImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <TickTickMigrationView
            preview={tickTickPreview}
            isImporting={isImportingTickTick}
            includeCompleted={includeCompletedTickTick}
            onIncludeCompletedChange={setIncludeCompletedTickTick}
            onCommit={handleConfirmTickTickImport}
            onCancel={handleCancelTickTickImport}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  if (googleTasksPreview) {
    const subtasksFlattened = googleTasksPreview.projects.reduce(
      (acc, project) =>
        acc + project.tasks.filter((task) => task.originalDepth >= 2).length,
      0,
    );
    const completedTasksCount = googleTasksPreview.projects.reduce(
      (acc, project) =>
        acc + project.tasks.filter((task) => task.isCompleted).length,
      0,
    );
    const importableTasksCount = includeCompletedGoogleTasks
      ? googleTasksPreview.totalTasks
      : googleTasksPreview.totalTasks - completedTasksCount;

    const dateRange = formatDateRange(
      googleTasksPreview.earliestDate,
      googleTasksPreview.latestDate,
    );

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelGoogleTasksImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <ResponsiveDialogHeader className="p-4 sm:p-6 pb-2 shrink-0 text-left">
            <ResponsiveDialogTitle className="type-h2">
              Confirm Google Tasks Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Review detected tasks before importing into Kagelin.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-2">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total tasks found</dt>
                <dd className="font-medium">{googleTasksPreview.totalTasks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Top-level tasks</dt>
                <dd>{googleTasksPreview.rootTasksCount}</dd>
              </div>
              {googleTasksPreview.subtasksCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Steps</dt>
                  <dd>{googleTasksPreview.subtasksCount}</dd>
                </div>
              )}
              {subtasksFlattened > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Nested steps flattened
                  </dt>
                  <dd>{subtasksFlattened}</dd>
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
                <dd>{googleTasksPreview.projects.length}</dd>
              </div>
              {googleTasksPreview.newProjectCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">New projects</dt>
                  <dd>{googleTasksPreview.newProjectCount}</dd>
                </div>
              )}
              {googleTasksPreview.mergedProjectCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Merged into existing
                  </dt>
                  <dd>{googleTasksPreview.mergedProjectCount}</dd>
                </div>
              )}
              {googleTasksPreview.duplicateTasksSkipped > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duplicates skipped</dt>
                  <dd>{googleTasksPreview.duplicateTasksSkipped}</dd>
                </div>
              )}
              {googleTasksPreview.subtasksReassigned > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Steps re-attached to matching tasks
                  </dt>
                  <dd>{googleTasksPreview.subtasksReassigned}</dd>
                </div>
              )}
              {completedTasksCount > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <label
                    htmlFor="google-tasks-include-completed"
                    className="cursor-pointer text-sm text-muted-foreground"
                  >
                    Include completed tasks ({completedTasksCount})
                  </label>
                  <input
                    id="google-tasks-include-completed"
                    type="checkbox"
                    checked={includeCompletedGoogleTasks}
                    onChange={(e) =>
                      setIncludeCompletedGoogleTasks(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-border"
                    disabled={isImportingGoogleTasks}
                  />
                </div>
              )}
            </dl>

            {googleTasksPreview.projects.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Detected lists
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {googleTasksPreview.projects.map((project) => (
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
              onClick={handleCancelGoogleTasksImport}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGoogleTasksImport}
              disabled={isImportingGoogleTasks}
            >
              {isImportingGoogleTasks ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                `Import ${importableTasksCount} tasks`
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  if (todoistPreview) {
    const isArchive = isArchivePreview(todoistPreview);
    const dateRange = formatDateRange(
      todoistPreview.earliestDate,
      todoistPreview.latestDate,
    );

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelTodoistImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <ResponsiveDialogHeader className="p-4 sm:p-6 pb-2 shrink-0 text-left">
            <ResponsiveDialogTitle className="type-h2">
              Confirm Todoist Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Review detected tasks before importing into Kagelin.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-2">
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

          <div className="flex justify-end gap-2 p-4 sm:p-6 pt-2 border-t border-border/40 shrink-0">
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
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
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
    const dateRange = formatDateRange(preview.earliest, preview.latest);

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <ResponsiveDialogHeader className="p-4 sm:p-6 pb-2 shrink-0 text-left">
            <ResponsiveDialogTitle className="type-h2">
              Confirm Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              This is a large import — review before adding it to your calendar.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-2">
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

          <div className="flex justify-end gap-2 p-4 sm:p-6 pt-2 border-t border-border/40 shrink-0">
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
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
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
      <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
        <ResponsiveDialogHeader className="p-4 sm:p-6 pb-2 shrink-0 text-left">
          <ResponsiveDialogTitle className="type-h2">
            App Migration
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Import data from or export data to other productivity apps.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                <ArrowDownToLine aria-hidden="true" strokeWidth={2.25} />
                <span className="truncate">Import</span>
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="h-full px-2"
                aria-label="Export to other apps"
              >
                <ArrowUpFromLine aria-hidden="true" strokeWidth={2.25} />
                <span className="truncate">Export</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="m-0">
              {googleTasksDrillDown ? (
                /* Variant B: Dedicated Drill-down Sub-view */
                <div className="space-y-4 min-h-[340px]">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        trigger("tick");
                        setGoogleTasksDrillDown(false);
                      }}
                      className="h-7 px-2 -ml-1 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      aria-label="Back to all apps"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Back
                    </Button>
                    <span className="text-xs font-medium text-foreground">
                      Google Tasks Import
                    </span>
                  </div>

                  {/* Row 1: Direct OAuth */}
                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Connect Google Tasks"
                    onClick={() => void handleConnectGoogleTasks()}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        !isAnyImporting
                      ) {
                        e.preventDefault();
                        void handleConnectGoogleTasks();
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GoogleTasksIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                          Connect Google Account
                          <BetaBadge />
                        </p>
                        <p className="text-xs text-muted-foreground lowercase truncate">
                          Direct OAuth automated sync
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      disabled={isAnyImporting}
                    >
                      {isImportingGoogleTasks ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <Link2 className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </Button>
                  </div>

                  {/* Row 2: Takeout JSON file */}
                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Import Google Tasks Takeout JSON file"
                    onClick={(e) => {
                      if (
                        isAnyImporting ||
                        e.target === googleTasksInputRef.current
                      )
                        return;
                      trigger("toggle");
                      googleTasksInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isAnyImporting) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        googleTasksInputRef.current?.click();
                      }
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
                        void processGoogleTasksFile(file);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GoogleTasksIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                          Google Takeout
                        </p>
                        <p className="text-xs text-muted-foreground lowercase truncate">
                          Upload Takeout Tasks.json file
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="h-8 transition-opacity text-brand pointer-events-none ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      disabled={isAnyImporting}
                    >
                      <FileUp className="h-4 w-4" strokeWidth={2.25} />
                    </Button>
                  </div>
                </div>
              ) : microsoftTasksDrillDown ? (
                /* Variant B: Dedicated Drill-down Sub-view (Microsoft To Do) */
                <MicrosoftTasksMigrationView
                  onBack={() => setMicrosoftTasksDrillDown(false)}
                  isImporting={isImportingMicrosoftTasks}
                  state={microsoftTasksState}
                  onConnectOAuth={() => void prepareMicrosoftOAuthImport()}
                  onFileSelect={(file) => void prepareMicrosoftFileImport(file)}
                />
              ) : (
                <div className="space-y-4 min-h-[340px]">
                  {/* ICS Card */}
                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Import ICS calendar file"
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                    onClick={(e) => {
                      if (isAnyImporting || e.target === icsInputRef.current)
                        return;
                      trigger("toggle");
                      icsInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isAnyImporting) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        icsInputRef.current?.click();
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand/10 text-brand shrink-0 flex items-center justify-center">
                        <Calendar className="h-5 w-5" strokeWidth={2.25} />
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
                      tabIndex={-1}
                      aria-hidden="true"
                      className={cn(
                        "h-8 transition-opacity text-brand pointer-events-none",
                        isImportingIcs
                          ? "opacity-100"
                          : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                      )}
                      disabled={isAnyImporting}
                    >
                      {isImportingIcs ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <FileUp className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </Button>
                    <input
                      ref={icsInputRef}
                      type="file"
                      accept=".ics,text/calendar"
                      className="hidden"
                      aria-label="Upload iCalendar ICS file"
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleImportIcs}
                    />
                  </div>

                  {/* Loop Habit Tracker Card */}
                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Import Loop Habit Tracker database file"
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                    onClick={(e) => {
                      if (isAnyImporting || e.target === fileInputRef.current)
                        return;
                      trigger("toggle");
                      fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isAnyImporting) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        fileInputRef.current?.click();
                      }
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
                        void processUhabitsFile(file);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <LoopIcon className="h-9 w-9 shrink-0 rounded-full shadow-xs" />
                      <div>
                        <p className="text-sm font-medium">
                          Loop Habit Tracker
                        </p>
                        <p className="text-xs text-muted-foreground lowercase">
                          Import habits from .db backup
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      tabIndex={-1}
                      aria-hidden="true"
                      className={cn(
                        "h-8 transition-opacity text-brand pointer-events-none",
                        isImportingUhabits
                          ? "opacity-100"
                          : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                      )}
                      disabled={isAnyImporting}
                    >
                      {isImportingUhabits ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <FileUp className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".db"
                      className="hidden"
                      aria-label="Upload Loop Habit Tracker database file"
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleImportUhabits}
                    />
                  </div>

                  {/* Google Tasks Card */}
                  {isGuestMode ? (
                    <div
                      role="button"
                      tabIndex={isAnyImporting ? -1 : 0}
                      aria-disabled={isAnyImporting}
                      aria-label="Import Google Tasks from Takeout JSON"
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                        isAnyImporting &&
                          "opacity-60 cursor-not-allowed pointer-events-none",
                      )}
                      onClick={(e) => {
                        if (
                          isAnyImporting ||
                          e.target === googleTasksInputRef.current
                        )
                          return;
                        trigger("toggle");
                        googleTasksInputRef.current?.click();
                      }}
                      onKeyDown={(e) => {
                        if (isAnyImporting) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          trigger("toggle");
                          googleTasksInputRef.current?.click();
                        }
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
                          void processGoogleTasksFile(file);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <GoogleTasksIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            Google Tasks
                            <BetaBadge />
                          </p>
                          <p className="text-xs text-muted-foreground lowercase">
                            Import from Takeout .json
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        tabIndex={-1}
                        aria-hidden="true"
                        className={cn(
                          "h-8 transition-opacity text-brand pointer-events-none",
                          isImportingGoogleTasks
                            ? "opacity-100"
                            : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                        )}
                        disabled={isAnyImporting}
                      >
                        {isImportingGoogleTasks ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            strokeWidth={2.25}
                          />
                        ) : (
                          <FileUp className="h-4 w-4" strokeWidth={2.25} />
                        )}
                      </Button>
                    </div>
                  ) : (
                    /* Drill-down Sub-view Entry Card */
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Google Tasks import options"
                      onClick={() => {
                        trigger("toggle");
                        setGoogleTasksDrillDown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          trigger("toggle");
                          setGoogleTasksDrillDown(true);
                        }
                      }}
                      className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GoogleTasksIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                            Google Tasks
                            <BetaBadge />
                          </p>
                          <p className="text-xs text-muted-foreground lowercase truncate">
                            2 import methods available
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="h-8 text-muted-foreground group-hover:text-foreground pointer-events-none ml-auto shrink-0"
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                      </Button>
                    </div>
                  )}

                  {/* Microsoft To Do Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Microsoft To Do import options"
                    onClick={() => {
                      trigger("toggle");
                      setMicrosoftTasksDrillDown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        setMicrosoftTasksDrillDown(true);
                      }
                    }}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MicrosoftTasksGlyph className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                          Microsoft To Do
                          <BetaBadge />
                        </p>
                        <p className="text-xs text-muted-foreground lowercase truncate">
                          {isGuestMode
                            ? "Import from JSON or CSV"
                            : "2 import methods available"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="h-8 text-muted-foreground group-hover:text-foreground pointer-events-none ml-auto shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                    </Button>
                  </div>

                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Import TickTick tasks from CSV"
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                    onClick={(e) => {
                      if (
                        isAnyImporting ||
                        e.target === tickTickInputRef.current
                      )
                        return;
                      trigger("toggle");
                      tickTickInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isAnyImporting) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        tickTickInputRef.current?.click();
                      }
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
                        void processTickTickFile(file);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <TickTickIcon className="h-9 w-9 shrink-0 rounded-lg shadow-xs overflow-hidden" />
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          TickTick
                          <BetaBadge />
                        </p>
                        <p className="text-xs text-muted-foreground lowercase">
                          Import tasks from backup CSV
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      tabIndex={-1}
                      aria-hidden="true"
                      className={cn(
                        "h-8 transition-opacity text-brand pointer-events-none",
                        isImportingTickTick
                          ? "opacity-100"
                          : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                      )}
                      disabled={isAnyImporting}
                    >
                      {isImportingTickTick ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <FileUp className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </Button>
                    <input
                      ref={tickTickInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      aria-label="Upload TickTick CSV file"
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleImportTickTick}
                    />
                  </div>

                  {/* Todoist Card */}
                  <div
                    role="button"
                    tabIndex={isAnyImporting ? -1 : 0}
                    aria-disabled={isAnyImporting}
                    aria-label="Import Todoist tasks from CSV or ZIP"
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                      isAnyImporting &&
                        "opacity-60 cursor-not-allowed pointer-events-none",
                    )}
                    onClick={(e) => {
                      if (
                        isAnyImporting ||
                        e.target === todoistInputRef.current
                      )
                        return;
                      trigger("toggle");
                      todoistInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isAnyImporting) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        trigger("toggle");
                        todoistInputRef.current?.click();
                      }
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
                      tabIndex={-1}
                      aria-hidden="true"
                      className={cn(
                        "h-8 transition-opacity text-brand pointer-events-none",
                        isImportingTodoist
                          ? "opacity-100"
                          : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                      )}
                      disabled={isAnyImporting}
                    >
                      {isImportingTodoist ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <FileUp className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </Button>
                    <input
                      ref={todoistInputRef}
                      type="file"
                      accept=".csv,.zip,text/csv,application/zip"
                      className="hidden"
                      aria-label="Upload Todoist CSV or ZIP backup file"
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleImportTodoist}
                    />
                  </div>
                </div>
              )}

              <input
                ref={googleTasksInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="Upload Google Takeout Tasks.json file"
                onClick={(e) => e.stopPropagation()}
                onChange={handleImportGoogleTasksTakeout}
              />
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
