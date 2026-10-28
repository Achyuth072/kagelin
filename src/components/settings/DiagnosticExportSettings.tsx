"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  Check,
  Copy,
  Download,
  Eye,
  Loader2,
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
import type { DiagnosticBundle } from "@/lib/diagnostics/collectDiagnosticBundle";
import { SUPPORT_EMAIL } from "@/lib/links";
import { notify } from "@/lib/notify";
import { triggerDownload } from "@/lib/utils/stats-export";
import { exportDiagnosticReport } from "@/lib/errors/diagnostics";

function downloadBundle(json: string) {
  const filename = `kagelin-diagnostic-${new Date().toISOString().split("T")[0]}.json`;
  triggerDownload(filename, json, "application/json");
}

export function DiagnosticExportSettings() {
  const [open, setOpen] = useState(false);
  const [includeDataStructure, setIncludeDataStructure] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [markdownReport, setMarkdownReport] = useState<string>("");
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [copied, setCopied] = useState(false);
  const { generateBundle } = useDiagnosticBundle();

  const handleOpen = async () => {
    setOpen(true);
    if (!markdownReport) {
      setLoadingReport(true);
      try {
        const report = await exportDiagnosticReport();
        setMarkdownReport(report);
      } catch {
        notify.error("Couldn't generate diagnostic report");
      } finally {
        setLoadingReport(false);
      }
    }
  };

  const handleToggleDataStructure = async (checked: boolean) => {
    setIncludeDataStructure(checked);
    if (checked && !bundle) {
      setLoadingBundle(true);
      try {
        const b = await generateBundle();
        setBundle(b);
      } catch {
        notify.error("Couldn't generate state bundle");
        setIncludeDataStructure(false);
      } finally {
        setLoadingBundle(false);
      }
    }
  };

  const jsonString = bundle ? JSON.stringify(bundle, null, 2) : "";
  const isLoading = loadingReport || (includeDataStructure && loadingBundle);

  const handleCopy = async () => {
    const textToCopy = includeDataStructure ? jsonString : markdownReport;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
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
              <Bug className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Report a Problem</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={handleOpen}
          >
            <Eye className="h-4 w-4" />
            Open Report
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Inspect and export system diagnostics or crash logs for bug reports.
          Personal content (tasks, habits, notes) is never included.
        </p>
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-xl border-border/80 shadow-none p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
          <ResponsiveDialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/80 shrink-0 text-left">
            <ResponsiveDialogTitle className="type-h2">
              Diagnostic Report
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Review system specs and logs. Personal content (task, habit, and
              event names) is never included.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {includeDataStructure ? (
              <div
                role="alert"
                className="flex gap-2.5 text-xs text-destructive-surface-foreground bg-destructive-surface border border-destructive-surface-border rounded-lg p-3"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> Structural metadata includes your
                  routine timestamps, recurrence rules, and time zone. Please
                  send this directly to support — do not post it publicly on
                  GitHub.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2.5">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Safe for public bug reports on GitHub. Stack traces and error
                  messages are pre-scrubbed of personal data.
                </span>
              </div>
            )}

            <div className="relative">
              {isLoading ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 bg-secondary/20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {loadingBundle
                      ? "Compiling state bundle…"
                      : "Loading diagnostics…"}
                  </p>
                </div>
              ) : (
                <pre
                  data-vaul-no-drag
                  tabIndex={0}
                  className="max-h-[30vh] sm:max-h-[40vh] overflow-auto rounded-lg border border-border/40 bg-secondary/20 p-3 text-xs whitespace-pre-wrap break-all font-mono select-text"
                >
                  {includeDataStructure
                    ? jsonString
                    : markdownReport || "No errors recorded."}
                </pre>
              )}
            </div>

            {/* Advanced toggle */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border/40 bg-secondary/10">
              <div className="space-y-0.5">
                <label
                  htmlFor="toggle-advanced-data"
                  className="text-xs font-medium cursor-pointer"
                >
                  Include database schedule structure (Advanced)
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Includes task counts, recurrence rules, and streak metadata
                  (no text). Needed only for complex sync or calendar bugs.
                </p>
              </div>
              <Switch
                id="toggle-advanced-data"
                checked={includeDataStructure}
                onCheckedChange={handleToggleDataStructure}
              />
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Questions or private inquiries? Reach us directly at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          {/* Sticky footer with actions and mobile-friendly close button */}
          <div className="p-4 border-t border-border/80 shrink-0 bg-background/95 backdrop-blur-sm flex flex-col-reverse sm:flex-row justify-end gap-2 pb-safe sm:pb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>

            {includeDataStructure && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => downloadBundle(jsonString)}
                disabled={isLoading || !bundle}
              >
                <Download className="h-4 w-4" />
                Download JSON
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={handleCopy}
              disabled={isLoading}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
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
