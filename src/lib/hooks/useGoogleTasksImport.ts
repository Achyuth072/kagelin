"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import type { GoogleTasksImportPreview } from "@/lib/import/google-tasks/types";

export type GoogleTasksImportState =
  "idle" | "fetching" | "previewing" | "importing" | "error";

const COOKIE_NAME = "google_tasks_temp_token";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"),
  );
  return match ? decodeURIComponent(match[3]) : null;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

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

  const queryClient = useQueryClient();
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  const cancelImport = () => {
    setState("idle");
    setPreview(null);
    setError(null);
    setCurrentFileName("GoogleTasks.json");
  };

  const prepareTakeoutImport = async (
    file: File,
  ): Promise<GoogleTasksImportPreview | null> => {
    setState("fetching");
    setError(null);
    trigger("toggle");
    setCurrentFileName(file.name);
    setCurrentIngress("takeout_json");

    trackTelemetry("migration_event", {
      source: "google_tasks",
      ingress: "takeout_json",
      phase: "fetch",
      status: "started",
    });

    try {
      const text = await file.text();
      const dataset = parseTakeoutJson(text);
      const workspace = await fetchGoogleTasksWorkspace(isGuestMode);
      const plan = planGoogleTasksImport(dataset, workspace);

      if (plan.totalTasks === 0) {
        notify.error("No valid tasks found in Takeout export");
        trigger("thud");
        setState("idle");
        return null;
      }

      setPreview(plan);
      setState("previewing");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress: "takeout_json",
        phase: "plan",
        status: "completed",
        task_count: plan.totalTasks,
      });

      return plan;
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
        error_code: msg,
      });

      return null;
    }
  };

  const prepareOAuthImport = useCallback(
    async (token?: string): Promise<GoogleTasksImportPreview | null> => {
      let accessToken = token;

      if (!accessToken) {
        accessToken = getCookie(COOKIE_NAME) ?? undefined;
      }

      if (!accessToken) {
        if (typeof window !== "undefined") {
          const returnTo =
            window.location.pathname +
            (window.location.search || "?tab=backup");
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

      // Ephemeral token consumed — clear cookie and URL params
      clearCookie(COOKIE_NAME);
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

      setState("fetching");
      setError(null);
      trigger("toggle");
      setCurrentFileName("GoogleTasks-OAuth");
      setCurrentIngress("oauth");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress: "oauth",
        phase: "fetch",
        status: "started",
      });

      try {
        const dataset = await fetchGoogleTasksDataset(accessToken);
        const workspace = await fetchGoogleTasksWorkspace(isGuestMode);
        const plan = planGoogleTasksImport(dataset, workspace);

        if (plan.totalTasks === 0) {
          notify.error("No tasks found in Google Tasks account");
          trigger("thud");
          setState("idle");
          return null;
        }

        setPreview(plan);
        setState("previewing");

        trackTelemetry("migration_event", {
          source: "google_tasks",
          ingress: "oauth",
          phase: "plan",
          status: "completed",
          task_count: plan.totalTasks,
        });

        return plan;
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

        trackTelemetry("migration_event", {
          source: "google_tasks",
          ingress: "oauth",
          phase: "fetch",
          status: "failed",
          error_code: msg,
        });

        return null;
      }
    },
    [isGuestMode, trigger],
  );

  const commitImport = async (
    targetPreview: GoogleTasksImportPreview | null = preview,
  ): Promise<boolean> => {
    if (!targetPreview) return false;

    setState("importing");
    trigger("toggle");
    const loadingToastId = notify.loading(
      `Importing ${targetPreview.totalTasks} tasks...`,
    );
    const startTime = performance.now();

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

      const msg =
        err instanceof GoogleTasksImportFailure || err instanceof Error
          ? err.message
          : "Critical error during import";

      notify.error(msg, { id: loadingToastId });
      trigger("thud");
      setError(msg);
      setState("error");

      trackTelemetry("migration_event", {
        source: "google_tasks",
        ingress: currentIngress,
        phase: "commit",
        status: "failed",
        error_code: msg,
      });

      return false;
    }
  };

  // Auto-connect detection on OAuth callback return
  useEffect(() => {
    if (typeof window === "undefined" || isAutoConnectingRef.current) return;

    const cookieToken = getCookie(COOKIE_NAME);
    const hasConnectedParam =
      window.location.search.includes("connected=google_tasks") ||
      Boolean(cookieToken);

    if (hasConnectedParam && state === "idle" && !preview) {
      isAutoConnectingRef.current = true;
      void prepareOAuthImport();
    }
  }, [preview, state, prepareOAuthImport]);

  return {
    prepareOAuthImport,
    prepareTakeoutImport,
    commitImport,
    cancelImport,
    preview,
    state,
    status: state,
    isImporting: state === "fetching" || state === "importing",
    error,
    fileName: currentFileName,
  };
}
