"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { notify } from "@/lib/notify";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import { trackTelemetry } from "@/lib/telemetry/client";
import { parseTickTickCsv } from "@/lib/import/ticktick/parser";
import { mapTickTickTasks } from "@/lib/import/ticktick/mapper";
import { planTickTickImport } from "@/lib/import/ticktick/plan";
import {
  executeTickTickImport,
  TickTickImportFailure,
} from "@/lib/import/ticktick/importTickTick";
import { fetchTickTickWorkspace } from "@/lib/import/ticktick/workspace";
import type { TickTickImportPreview } from "@/lib/import/ticktick/types";

export type TickTickImportState = "idle" | "previewing" | "importing" | "error";

export function useTickTickImport() {
  const [state, setState] = useState<TickTickImportState>("idle");
  const [preview, setPreview] = useState<TickTickImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] =
    useState<string>("TickTickBackup.csv");
  const abortControllerRef = useRef<AbortController | null>(null);

  const queryClient = useQueryClient();
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  const isImporting = state === "importing";

  const cancelImport = () => {
    if (state === "importing") {
      abortControllerRef.current?.abort();
    }
    trackTelemetry("migration_event", {
      source: "ticktick",
      ingress: "csv_file",
      phase: state === "previewing" ? "plan" : "commit",
      status: "failed",
      milestone: "migration_cancelled",
      error_code: "aborted",
    });
    setState("idle");
    setPreview(null);
    setError(null);
    setCurrentFileName("TickTickBackup.csv");
  };

  const prepareImport = async (
    file: File,
  ): Promise<TickTickImportPreview | null> => {
    setError(null);
    trigger("toggle");
    setCurrentFileName(file.name);

    trackTelemetry("migration_event", {
      source: "ticktick",
      ingress: "csv_file",
      phase: "fetch",
      status: "started",
      milestone: "migration_started",
    });

    try {
      const csvText = await file.text();
      if (!csvText.trim()) {
        notify.error("No valid tasks found in TickTick import");
        trigger("thud");
        setState("idle");
        setPreview(null);
        return null;
      }

      const parsedRows = parseTickTickCsv(csvText);
      const mappedTasks = mapTickTickTasks(parsedRows);

      if (mappedTasks.length === 0) {
        notify.error("No valid tasks found in TickTick import");
        trigger("thud");
        setState("idle");
        setPreview(null);
        return null;
      }

      const workspace = await fetchTickTickWorkspace(isGuestMode);
      const plan = planTickTickImport(mappedTasks, workspace, {
        isGuest: isGuestMode,
        rawSource: {
          rows: parsedRows,
          csvContent: csvText,
        },
      });

      if (plan.totalTasks === 0) {
        notify.error("No valid tasks found in TickTick import");
        trigger("thud");
        setState("idle");
        setPreview(null);
        return null;
      }

      setPreview(plan);
      setState("previewing");

      trackTelemetry("migration_event", {
        source: "ticktick",
        ingress: "csv_file",
        phase: "plan",
        status: "completed",
        task_count: plan.totalTasks,
      });

      return plan;
    } catch (err) {
      console.error("Failed to parse TickTick import:", err);
      void recordDiagnosticError(err, {
        provider: "ticktick",
        importStage: "parse",
      });

      const msg =
        err instanceof Error ? err.message : "Failed to parse TickTick backup";
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "ticktick",
        ingress: "csv_file",
        phase: "fetch",
        status: "failed",
        error_code: "parse_failed",
      });

      return null;
    }
  };

  const commitImport = async (options?: {
    includeCompleted?: boolean;
  }): Promise<boolean> => {
    if (!preview) return false;

    setState("importing");
    trigger("toggle");
    const loadingToastId = notify.loading(
      `Importing ${preview.totalTasks} tasks...`,
    );
    const startTime = performance.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    trackTelemetry("migration_event", {
      source: "ticktick",
      ingress: "csv_file",
      phase: "commit",
      status: "started",
    });

    try {
      const { importedCount, createdProjectCount } =
        await executeTickTickImport(preview, {
          signal: controller.signal,
          includeCompleted: options?.includeCompleted ?? true,
          isGuest: isGuestMode,
          fileName: currentFileName,
        });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
      ]);

      notifyLocalEdit();

      const durationMs = Math.round(performance.now() - startTime);
      trackTelemetry("migration_event", {
        source: "ticktick",
        ingress: "csv_file",
        phase: "commit",
        status: "completed",
        milestone: "migration_completed",
        task_count: importedCount,
        duration_ms: durationMs,
      });

      notify.success(
        createdProjectCount > 0
          ? `Imported ${importedCount} tasks and ${createdProjectCount} projects from TickTick`
          : `Successfully imported ${importedCount} tasks from TickTick`,
        { id: loadingToastId },
      );
      trigger("success");

      setState("idle");
      setPreview(null);
      return true;
    } catch (err) {
      console.error("Failed to import TickTick tasks:", err);
      void recordDiagnosticError(err, {
        provider: "ticktick",
        importStage: "commit",
        taskCount: preview.totalTasks,
        duplicateCount: preview.duplicateTasksSkipped,
      });

      const isAborted =
        controller.signal.aborted ||
        (err instanceof Error && err.message.includes("aborted"));
      const msg = isAborted
        ? "Import cancelled by user"
        : err instanceof TickTickImportFailure || err instanceof Error
          ? err.message
          : "Critical error during import";

      if (isAborted) {
        notify.error("Import cancelled and rolled back", {
          id: loadingToastId,
        });
      } else {
        notify.error(msg, { id: loadingToastId });
      }
      trigger("thud");
      setError(msg);
      setState(isAborted ? "idle" : "error");

      trackTelemetry("migration_event", {
        source: "ticktick",
        ingress: "csv_file",
        phase: "commit",
        status: "failed",
        error_code: isAborted ? "aborted" : "commit_failed",
      });

      return false;
    }
  };

  return {
    isImporting,
    preview,
    state,
    error,
    currentFileName,
    prepareImport,
    commitImport,
    cancelImport,
  };
}
