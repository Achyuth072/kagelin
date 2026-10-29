"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bug,
  Check,
  Copy,
  Download,
  Eye,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { useDiagnosticBundle } from "@/lib/hooks/useDiagnosticBundle";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { DiagnosticBundle } from "@/lib/diagnostics/collectDiagnosticBundle";
import { SUPPORT_EMAIL } from "@/lib/links";
import { notify } from "@/lib/notify";
import { triggerDownload } from "@/lib/utils/stats-export";
import { cn } from "@/lib/utils";
import { clearDiagnosticErrors } from "@/lib/errors/diagnostics";

function downloadBundle(json: string) {
  const filename = `kagelin-diagnostic-${new Date().toISOString().split("T")[0]}.json`;
  triggerDownload(filename, json, "application/json");
}

function formatCapturedAt(capturedAt: Date, now: number): string {
  const elapsedSeconds = Math.max(
    0,
    Math.round((now - capturedAt.getTime()) / 1000),
  );
  const relative =
    elapsedSeconds < 45
      ? "just now"
      : `${Math.round(elapsedSeconds / 60)} min ago`;
  return `${relative} (${capturedAt.toLocaleTimeString()})`;
}

export function DiagnosticExportSettings() {
  const { trigger } = useHaptic();
  const [open, setOpen] = useState(false);
  const [includeDataStructure, setIncludeDataStructure] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [markdownReport, setMarkdownReport] = useState<string>("");
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [copied, setCopied] = useState(false);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { generateBundle, generateReport } = useDiagnosticBundle();
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingClear) {
      confirmButtonRef.current?.focus();
    }
  }, [confirmingClear]);

  useEffect(() => {
    if (!open || !capturedAt) return;
    const intervalId = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(intervalId);
  }, [open, capturedAt]);

  const loadReport = async () => {
    const report = await generateReport();
    setMarkdownReport(report);
    setCapturedAt(new Date());
    setNow(Date.now());
    return report;
  };

  const refreshReport = async () => {
    await loadReport();
    if (includeDataStructure) {
      try {
        setBundle(await generateBundle());
      } catch {
        notify.error("Couldn't refresh state bundle");
      }
    }
  };

  const runRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshReport();
    } catch {
      notify.error("Couldn't generate diagnostic report");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpen = async () => {
    trigger("toggle");
    setOpen(true);
    setConfirmingClear(false);
    await runRefresh();
  };

  const handleRefresh = async () => {
    trigger("toggle");
    await runRefresh();
  };

  const handleConfirmClear = async () => {
    trigger("thud");
    setIsClearing(true);
    try {
      await clearDiagnosticErrors();
      setBundle(null);
      setIncludeDataStructure(false);
      try {
        await loadReport();
        notify.success("Diagnostic errors cleared");
      } catch {
        notify.error(
          "Diagnostic errors cleared, but the report couldn't refresh",
        );
      }
    } catch {
      notify.error("Couldn't clear diagnostic errors");
    } finally {
      setIsClearing(false);
      setConfirmingClear(false);
    }
  };

  const handleToggleDataStructure = async (checked: boolean) => {
    trigger("toggle");
    setIncludeDataStructure(checked);
    if (checked && !bundle) {
      setLoadingBundle(true);
      try {
        const freshBundle = await generateBundle();
        setBundle(freshBundle);
      } catch {
        notify.error("Couldn't generate state bundle");
        setIncludeDataStructure(false);
      } finally {
        setLoadingBundle(false);
      }
    }
  };

  const jsonString = bundle ? JSON.stringify(bundle, null, 2) : "";
  const isInitialLoading = !markdownReport && isRefreshing;
  const isBusy = isRefreshing || isClearing || loadingBundle;

  const handleCopy = async () => {
    const textToCopy = includeDataStructure ? jsonString : markdownReport;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      trigger("success");
      setCopied(true);
      notify.success(
        includeDataStructure
          ? "Diagnostic bundle copied (contains schedule data)"
          : "Diagnostic report copied",
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Couldn't copy to clipboard");
    }
  };

  return (
    <>
      <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-background">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-full bg-secondary/30 shrink-0">
              <Bug
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">Report a Problem</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={handleOpen}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Open Report
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Inspect and export system diagnostics or crash logs for bug reports.
          Personal content (tasks, habits, notes) is never included.
        </p>
      </div>

      <ResponsiveDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setConfirmingClear(false);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-xl border-border/80 shadow-none p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <ResponsiveDialogHeader className="p-4 sm:p-6 pb-4 border-b border-border/80 shrink-0 text-left pr-12 sm:pr-14">
            <ResponsiveDialogTitle className="type-h2">
              Diagnostic Report
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Review system specs and logs. Personal content (task, habit, and
              event names) is never included.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {includeDataStructure ? (
              <div
                role="status"
                aria-live="polite"
                className="flex gap-2.5 text-xs text-destructive-surface-foreground bg-destructive-surface border border-destructive-surface-border rounded-lg p-3 min-h-[44px]"
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p>
                  <strong>Notice:</strong> Structural metadata includes your
                  routine timestamps, recurrence rules, and time zone. Please
                  send this directly to support — do not post it publicly on
                  GitHub.
                </p>
              </div>
            ) : (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2.5 text-xs text-foreground/80 bg-secondary/40 border border-border/50 rounded-lg p-3 min-h-[44px]"
              >
                <Check
                  className="h-4 w-4 text-primary shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Safe for public bug reports on GitHub. Stack traces and error
                  messages are pre-scrubbed of personal data.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium truncate">
                  {capturedAt
                    ? `Captured ${formatCapturedAt(capturedAt, now)}`
                    : "Report Preview"}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {confirmingClear ? (
                    <div
                      role="group"
                      aria-label="Confirm log clearing"
                      className="flex items-center gap-1.5"
                    >
                      <span
                        id="clear-log-prompt"
                        className="text-xs text-muted-foreground mr-1"
                      >
                        Clear errors?
                      </span>
                      <Button
                        ref={confirmButtonRef}
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 px-2.5 text-xs min-h-[36px] sm:min-h-[32px]"
                        onClick={handleConfirmClear}
                        disabled={isClearing}
                        aria-describedby="clear-log-prompt"
                      >
                        {isClearing && (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin mr-1 motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        )}
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs min-h-[36px] sm:min-h-[32px]"
                        onClick={() => {
                          trigger("tick");
                          setConfirmingClear(false);
                          clearButtonRef.current?.focus();
                        }}
                        disabled={isClearing}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Refresh"
                        className="h-8 px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-0 text-muted-foreground hover:text-foreground transition-seijaku-fast"
                        onClick={handleRefresh}
                        disabled={isBusy}
                      >
                        <RotateCw
                          className={cn(
                            "h-3.5 w-3.5 motion-reduce:animate-none",
                            isRefreshing && "animate-spin",
                          )}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">Refresh</span>
                      </Button>
                      <Button
                        ref={clearButtonRef}
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Clear Log"
                        className="h-8 px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-0 text-muted-foreground hover:text-destructive transition-seijaku-fast"
                        onClick={() => {
                          trigger("tick");
                          setConfirmingClear(true);
                        }}
                        disabled={isBusy}
                      >
                        <Trash2
                          className="h-3.5 w-3.5"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">Clear Log</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                {isInitialLoading ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="h-64 sm:h-72 flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 bg-secondary/20"
                  >
                    <Loader2
                      className="h-5 w-5 animate-spin motion-reduce:animate-none text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      Loading diagnostics…
                    </p>
                  </div>
                ) : (
                  <>
                    <pre
                      data-vaul-no-drag
                      tabIndex={0}
                      role="region"
                      aria-label="Diagnostic report preview"
                      aria-busy={isRefreshing || loadingBundle}
                      className={cn(
                        "h-64 sm:h-72 overflow-auto rounded-lg border border-border/40 bg-secondary/20 p-3 text-xs whitespace-pre-wrap break-all font-mono select-text transition-opacity transition-seijaku-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        isRefreshing || loadingBundle
                          ? "opacity-60 pointer-events-none"
                          : "opacity-100",
                      )}
                    >
                      {includeDataStructure
                        ? jsonString
                        : markdownReport || "No errors recorded."}
                    </pre>

                    {loadingBundle && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-[1px]"
                      >
                        <Loader2
                          className="h-5 w-5 animate-spin motion-reduce:animate-none text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-xs text-muted-foreground">
                          Compiling state bundle…
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Advanced toggle */}
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg border border-border/50 bg-secondary/10">
              <div className="space-y-1">
                <label
                  htmlFor="toggle-advanced-data"
                  className="text-sm font-medium cursor-pointer text-foreground block"
                >
                  Include database schedule structure (Advanced)
                </label>
                <p
                  id="toggle-advanced-desc"
                  className="text-xs text-muted-foreground leading-relaxed"
                >
                  Includes task counts, recurrence rules, and streak metadata
                  (no text). Needed only for complex sync or calendar bugs.
                </p>
              </div>
              <Switch
                id="toggle-advanced-data"
                checked={includeDataStructure}
                onCheckedChange={handleToggleDataStructure}
                disabled={isBusy}
                aria-describedby="toggle-advanced-desc"
              />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Questions or private inquiries? Reach us directly at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                aria-label={`Send email to ${SUPPORT_EMAIL}`}
                className="underline underline-offset-2 text-foreground/80 hover:text-foreground transition-seijaku-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xs"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          {/* Sticky footer with actions */}
          <div className="p-4 border-t border-border/80 shrink-0 bg-background flex flex-col sm:flex-row justify-end gap-2 pb-safe sm:pb-4">
            {includeDataStructure && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 min-h-[36px]"
                onClick={() => {
                  trigger("tick");
                  downloadBundle(jsonString);
                }}
                disabled={isBusy || !bundle}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download JSON
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              className="gap-2 min-h-[36px]"
              onClick={handleCopy}
              disabled={isBusy}
              aria-live="polite"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {includeDataStructure
                    ? "Copy Full Bundle"
                    : "Copy for GitHub"}
                </>
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
