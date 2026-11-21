"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { notify } from "@/lib/notify";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import { trackTelemetry } from "@/lib/telemetry/client";
import {
  parseMicrosoftTasksJson,
  parseOutlookTasksCsv,
} from "@/lib/import/microsoft-tasks/parser";
import { planMicrosoftTasksImport } from "@/lib/import/microsoft-tasks/plan";
import {
  executeMicrosoftTasksImport,
  MicrosoftTasksImportFailure,
} from "@/lib/import/microsoft-tasks/executor";
import { fetchMicrosoftTasksDataset } from "@/lib/import/microsoft-tasks/adapter";
import { fetchMicrosoftTasksWorkspace } from "@/lib/import/microsoft-tasks/workspace";
import type {
  MicrosoftTasksDataset,
  MicrosoftTasksImportPreview,
} from "@/lib/import/microsoft-tasks/types";

export type MicrosoftTasksImportState =
  "idle" | "fetching" | "previewing" | "importing" | "error";

function redirectToMicrosoftTasksOAuth(returnTo: string): void {
  if (typeof window === "undefined") return;
  const target = new URL(
    "/api/calendar/connect/microsoft_tasks",
    window.location.origin,
  );
  target.searchParams.set("return_to", returnTo);
  window.location.assign(target.toString());
}

export function useMicrosoftTasksImport() {
  const [state, setState] = useState<MicrosoftTasksImportState>("idle");
  const [preview, setPreview] = useState<MicrosoftTasksImportPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>(
    "MicrosoftTasks.json",
  );
  const [currentIngress, setCurrentIngress] = useState<
    "oauth" | "json_file" | "csv_file"
  >("json_file");
  const isAutoConnectingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const queryClient = useQueryClient();
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  const cancelImport = () => {
    if (state === "importing") {
      abortControllerRef.current?.abort();
    }
    setState("idle");
    setPreview(null);
    setError(null);
    setCurrentFileName("MicrosoftTasks.json");
  };

  const prepareImportFromDataset = async (
    dataset: MicrosoftTasksDataset,
    ingress: "oauth" | "json_file" | "csv_file",
    fileName: string,
  ): Promise<MicrosoftTasksImportPreview | null> => {
    setState("fetching");
    setError(null);
    trigger("toggle");
    setCurrentFileName(fileName);
    setCurrentIngress(ingress);

    trackTelemetry("migration_event", {
      source: "microsoft_tasks",
      ingress,
      phase: "fetch",
      status: "started",
    });

    try {
      const workspace = await fetchMicrosoftTasksWorkspace(isGuestMode);
      const plan = planMicrosoftTasksImport(dataset, workspace);

      if (plan.totalTasks === 0) {
        notify.error(
          ingress === "oauth"
            ? "No tasks found in Microsoft To Do account"
            : "No valid tasks found in file export",
        );
        trigger("thud");
        setState("idle");
        return null;
      }

      setPreview(plan);
      setState("previewing");

      trackTelemetry("migration_event", {
        source: "microsoft_tasks",
        ingress,
        phase: "plan",
        status: "completed",
        task_count: plan.totalTasks,
      });

      return plan;
    } catch (err) {
      console.error(`Failed to plan Microsoft Tasks import (${ingress}):`, err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to process Microsoft Tasks data";
      void recordDiagnosticError(err, {
        provider: "microsoft_tasks",
        importStage: "plan",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "microsoft_tasks",
        ingress,
        phase: "fetch",
        status: "failed",
        error_code: "fetch_failed",
      });

      return null;
    }
  };

  const prepareFileImport = async (
    file: File,
  ): Promise<MicrosoftTasksImportPreview | null> => {
    try {
      const text = await file.text();
      const lowerName = file.name.toLowerCase();
      const isCsv =
        lowerName.endsWith(".csv") ||
        text.startsWith("Subject,") ||
        text.startsWith('"Subject",');

      const dataset = isCsv
        ? parseOutlookTasksCsv(text)
        : parseMicrosoftTasksJson(text);

      const ingress = isCsv ? "csv_file" : "json_file";
      return await prepareImportFromDataset(dataset, ingress, file.name);
    } catch (err) {
      console.error("Failed to parse Microsoft Tasks file:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to parse Microsoft Tasks file";
      void recordDiagnosticError(err, {
        provider: "microsoft_tasks",
        importStage: "parse",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "microsoft_tasks",
        ingress: "json_file",
        phase: "fetch",
        status: "failed",
        error_code: "parse_failed",
      });

      return null;
    }
  };

  const prepareJsonImport = async (
    file: File,
  ): Promise<MicrosoftTasksImportPreview | null> => {
    return prepareFileImport(file);
  };

  const prepareCsvImport = async (
    file: File,
  ): Promise<MicrosoftTasksImportPreview | null> => {
    return prepareFileImport(file);
  };

  const prepareOAuthImport = async (
    token?: string,
  ): Promise<MicrosoftTasksImportPreview | null> => {
    let accessToken = token;

    if (!accessToken) {
      if (
        typeof window !== "undefined" &&
        window.location.search.includes("connected=microsoft_tasks")
      ) {
        try {
          const res = await fetch(
            "/api/calendar/token?provider=microsoft_tasks",
          );
          if (res.ok) {
            const data = (await res.json()) as {
              access_token?: string;
              accessToken?: string;
            };
            accessToken = data.accessToken || data.access_token;
          }
        } catch (e) {
          void recordDiagnosticError(e, {
            provider: "microsoft_tasks",
            importStage: "token_fetch",
          });
        }
      }
    }

    if (!accessToken) {
      if (typeof window !== "undefined") {
        const returnTo =
          window.location.pathname + (window.location.search || "?tab=backup");
        trackTelemetry("migration_event", {
          source: "microsoft_tasks",
          ingress: "oauth",
          phase: "connect",
          status: "started",
        });
        redirectToMicrosoftTasksOAuth(returnTo);
      }
      return null;
    }

    // Ephemeral token consumed — clear connected URL param
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("connected")) {
        url.searchParams.delete("connected");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.search ? url.search : ""),
        );
      }
    }

    try {
      const dataset = await fetchMicrosoftTasksDataset(accessToken);
      return await prepareImportFromDataset(
        dataset,
        "oauth",
        "MicrosoftTasks-OAuth",
      );
    } catch (err) {
      console.error("Failed to fetch Microsoft Tasks via OAuth:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to fetch Microsoft Tasks data";
      void recordDiagnosticError(err, {
        provider: "microsoft_tasks",
        importStage: "fetch",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      const isRateLimit =
        msg.includes("429") || msg.toLowerCase().includes("rate limit");
      trackTelemetry("migration_event", {
        source: "microsoft_tasks",
        ingress: "oauth",
        phase: "fetch",
        status: "failed",
        error_code: isRateLimit ? "rate_limited" : "fetch_failed",
      });

      return null;
    }
  };

  const commitImport = async (
    targetPreview: MicrosoftTasksImportPreview | null = preview,
    options?: { includeCompleted?: boolean },
  ): Promise<boolean> => {
    if (!targetPreview) return false;

    setState("importing");
    trigger("toggle");
    const loadingToastId = notify.loading(
      `Importing ${targetPreview.totalTasks} tasks...`,
    );
    const startTime = performance.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    trackTelemetry("migration_event", {
      source: "microsoft_tasks",
      ingress: currentIngress,
      phase: "commit",
      status: "started",
    });

    try {
      const { importedCount, createdProjectCount } =
        await executeMicrosoftTasksImport(targetPreview, {
          isGuest: isGuestMode,
          fileName: currentFileName,
          signal: controller.signal,
          includeCompleted: options?.includeCompleted ?? true,
        });

      // 1. Invalidate TanStack query cache for affected entities
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);

      // 2. Notify local sync scheduler of edits
      notifyLocalEdit();

      const durationMs = Math.round(performance.now() - startTime);
      trackTelemetry("migration_event", {
        source: "microsoft_tasks",
        ingress: currentIngress,
        phase: "commit",
        status: "completed",
        task_count: importedCount,
        duration_ms: durationMs,
      });

      notify.success(
        createdProjectCount > 0
          ? `Imported ${importedCount} tasks and ${createdProjectCount} projects from Microsoft To Do`
          : `Successfully imported ${importedCount} tasks from Microsoft To Do`,
        { id: loadingToastId },
      );
      trigger("success");

      setState("idle");
      setPreview(null);
      return true;
    } catch (err) {
      console.error("Failed to import Microsoft Tasks:", err);
      void recordDiagnosticError(err, {
        provider: "microsoft_tasks",
        importStage: "commit",
      });

      const isAborted =
        controller.signal.aborted ||
        (err instanceof Error && err.message.includes("aborted"));
      const msg = isAborted
        ? "Import cancelled by user"
        : err instanceof MicrosoftTasksImportFailure || err instanceof Error
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
        source: "microsoft_tasks",
        ingress: currentIngress,
        phase: "commit",
        status: "failed",
        error_code: isAborted ? "aborted" : "commit_failed",
      });

      return false;
    }
  };

  const prepareOAuthImportRef = useRef(prepareOAuthImport);
  useEffect(() => {
    prepareOAuthImportRef.current = prepareOAuthImport;
  });

  // Auto-connect detection on OAuth callback return
  useEffect(() => {
    if (typeof window === "undefined" || isAutoConnectingRef.current) return;

    const hasConnectedParam = window.location.search.includes(
      "connected=microsoft_tasks",
    );

    if (hasConnectedParam && state === "idle" && !preview) {
      isAutoConnectingRef.current = true;
      void prepareOAuthImportRef.current();
    }
  }, [preview, state]);

  return {
    prepareOAuthImport,
    prepareFileImport,
    prepareJsonImport,
    prepareCsvImport,
    commitImport,
    cancelImport,
    preview,
    state,
    isImporting: state === "fetching" || state === "importing",
    error,
    fileName: currentFileName,
  };
}
