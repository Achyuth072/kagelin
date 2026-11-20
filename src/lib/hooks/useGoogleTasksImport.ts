"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { notify } from "@/lib/notify";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import { trackTelemetry } from "@/lib/telemetry/client";
import { parseTakeoutJson } from "@/lib/import/google-tasks/parser";
import { planGoogleTasksImport } from "@/lib/import/google-tasks/plan";
import {
  executeGoogleTasksImport,
  GoogleTasksImportFailure,
} from "@/lib/import/google-tasks/importGoogleTasks";
import { fetchGoogleTasksDataset } from "@/lib/import/google-tasks/adapter";
import { fetchGoogleTasksWorkspace } from "@/lib/import/google-tasks/workspace";
import type {
  GoogleTasksDataset,
  GoogleTasksImportPreview,
} from "@/lib/import/google-tasks/types";

export type GoogleTasksImportState =
  "idle" | "fetching" | "previewing" | "importing" | "error";

function redirectToGoogleTasksOAuth(returnTo: string): void {
  if (typeof window === "undefined") return;
  const target = new URL(
    "/api/calendar/connect/google_tasks",
    window.location.origin,
  );
  target.searchParams.set("return_to", returnTo);
  window.location.assign(target.toString());
}

export function useGoogleTasksImport() {
  const [state, setState] = useState<GoogleTasksImportState>("idle");
  const [preview, setPreview] = useState<GoogleTasksImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] =
    useState<string>("GoogleTasks.json");
  const [currentIngress, setCurrentIngress] = useState<
    "oauth" | "takeout_json"
  >("takeout_json");
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
    setCurrentFileName("GoogleTasks.json");
  };

  const prepareImportFromDataset = async (
    dataset: GoogleTasksDataset,
    ingress: "oauth" | "takeout_json",
    fileName: string,
  ): Promise<GoogleTasksImportPreview | null> => {
    setState("fetching");
    setError(null);
    trigger("toggle");
    setCurrentFileName(fileName);
    setCurrentIngress(ingress);

    trackTelemetry("migration_event", {
      source: "google_tasks",
      ingress,
      phase: "fetch",
      status: "started",
    });

    try {
      const workspace = await fetchGoogleTasksWorkspace(isGuestMode);
      const plan = planGoogleTasksImport(dataset, workspace);

      if (plan.totalTasks === 0) {
        notify.error(
          ingress === "oauth"
            ? "No tasks found in Google Tasks account"
            : "No valid tasks found in Takeout export",
        );
        trigger("thud");
        setState("idle");
        return null;
      }

      setPreview(plan);
      setState("previewing");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress,
        phase: "plan",
        status: "completed",
        task_count: plan.totalTasks,
      });

      return plan;
    } catch (err) {
      console.error(`Failed to plan Google Tasks import (${ingress}):`, err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to process Google Tasks data";
      void recordDiagnosticError(err, {
        provider: "google_tasks",
        importStage: "plan",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress,
        phase: "fetch",
        status: "failed",
        error_code: "fetch_failed",
      });

      return null;
    }
  };

  const prepareTakeoutImport = async (
    file: File,
  ): Promise<GoogleTasksImportPreview | null> => {
    try {
      const text = await file.text();
      const dataset = parseTakeoutJson(text);
      return await prepareImportFromDataset(dataset, "takeout_json", file.name);
    } catch (err) {
      console.error("Failed to parse Google Tasks Takeout:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to parse Google Tasks Takeout file";
      void recordDiagnosticError(err, {
        provider: "google_tasks",
        importStage: "parse",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress: "takeout_json",
        phase: "fetch",
        status: "failed",
        error_code: "parse_failed",
      });

      return null;
    }
  };

  const prepareOAuthImport = async (
    token?: string,
  ): Promise<GoogleTasksImportPreview | null> => {
    let accessToken = token;

    if (!accessToken) {
      if (
        typeof window !== "undefined" &&
        window.location.search.includes("connected=google_tasks")
      ) {
        try {
          const res = await fetch("/api/calendar/token?provider=google_tasks");
          if (res.ok) {
            const data = (await res.json()) as { access_token?: string };
            accessToken = data.access_token;
          }
        } catch (e) {
          void recordDiagnosticError(e, {
            provider: "google_tasks",
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
          source: "google_tasks",
          ingress: "oauth",
          phase: "connect",
          status: "started",
        });
        redirectToGoogleTasksOAuth(returnTo);
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
      const dataset = await fetchGoogleTasksDataset(accessToken);
      return await prepareImportFromDataset(
        dataset,
        "oauth",
        "GoogleTasks-OAuth",
      );
    } catch (err) {
      console.error("Failed to fetch Google Tasks via OAuth:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to fetch Google Tasks data";
      void recordDiagnosticError(err, {
        provider: "google_tasks",
        importStage: "fetch",
      });
      notify.error(msg);
      trigger("thud");
      setError(msg);
      setState("error");

      const isRateLimit =
        msg.includes("429") || msg.toLowerCase().includes("rate limit");
      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress: "oauth",
        phase: "fetch",
        status: "failed",
        error_code: isRateLimit ? "rate_limited" : "fetch_failed",
      });

      return null;
    }
  };

  const commitImport = async (
    targetPreview: GoogleTasksImportPreview | null = preview,
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
      source: "google_tasks",
      ingress: currentIngress,
      phase: "commit",
      status: "started",
    });

    try {
      const { importedCount, createdProjectCount } =
        await executeGoogleTasksImport(targetPreview, {
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
        source: "google_tasks",
        ingress: currentIngress,
        phase: "commit",
        status: "completed",
        task_count: importedCount,
        duration_ms: durationMs,
      });

      notify.success(
        createdProjectCount > 0
          ? `Imported ${importedCount} tasks and ${createdProjectCount} projects from Google Tasks`
          : `Successfully imported ${importedCount} tasks from Google Tasks`,
        { id: loadingToastId },
      );
      trigger("success");

      setState("idle");
      setPreview(null);
      return true;
    } catch (err) {
      console.error("Failed to import Google Tasks:", err);
      void recordDiagnosticError(err, {
        provider: "google_tasks",
        importStage: "commit",
      });

      const isAborted =
        controller.signal.aborted ||
        (err instanceof Error && err.message.includes("aborted"));
      const msg = isAborted
        ? "Import cancelled by user"
        : err instanceof GoogleTasksImportFailure || err instanceof Error
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
        source: "google_tasks",
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
      "connected=google_tasks",
    );

    if (hasConnectedParam && state === "idle" && !preview) {
      isAutoConnectingRef.current = true;
      void prepareOAuthImportRef.current();
    }
  }, [preview, state]);

  return {
    prepareOAuthImport,
    prepareTakeoutImport,
    commitImport,
    cancelImport,
    preview,
    state,
    isImporting: state === "fetching" || state === "importing",
    error,
    fileName: currentFileName,
  };
}
