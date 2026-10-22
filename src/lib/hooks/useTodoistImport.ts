"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAuth } from "@/components/AuthProvider";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import {
  prepareTodoistImport,
  executeTodoistImport,
  executeTodoistArchiveImport,
  TodoistImportFailure,
  type TodoistImportPreview,
} from "@/lib/import/todoist/importTodoist";
import { extractTodoistCsvFiles } from "@/lib/import/todoist/archive";
import {
  fetchTodoistImportProjects,
  fetchTodoistImportTasks,
} from "@/lib/import/todoist/workspace";
import {
  buildTodoistImportPlan,
  isArchivePreview,
  resolveImportTargetProjectIds,
  type TodoistArchiveImportPreview,
} from "@/lib/import/todoist/plan";

export type TodoistPreview = TodoistImportPreview | TodoistArchiveImportPreview;

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

export function useTodoistImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<TodoistPreview | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();
  const queryClient = useQueryClient();

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
    notifyLocalEdit();
  };

  const prepareImport = async (file: File): Promise<TodoistPreview | null> => {
    setIsImporting(true);
    trigger("toggle");
    try {
      const result = isZipFile(file)
        ? await prepareArchive(file)
        : await prepareSingleCsv(file);

      if (!result || result.totalTasks === 0) {
        notify.error("No valid tasks found in Todoist import");
        trigger("thud");
        return null;
      }

      setCurrentFileName(file.name);
      setPreview(result);
      return result;
    } catch (err) {
      console.error("Failed to parse Todoist import:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to parse Todoist import";
      notify.error(msg);
      trigger("thud");
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  const prepareSingleCsv = async (
    file: File,
  ): Promise<TodoistImportPreview> => {
    const text = await file.text();
    return prepareTodoistImport(text);
  };

  const prepareArchive = async (
    file: File,
  ): Promise<TodoistArchiveImportPreview> => {
    const buffer = await file.arrayBuffer();
    const files = extractTodoistCsvFiles(new Uint8Array(buffer));

    // Only the projects this backup writes into are read back.
    const projects = await fetchTodoistImportProjects(isGuestMode);
    const targetProjectIds = resolveImportTargetProjectIds(files, projects);
    const tasks = await fetchTodoistImportTasks(isGuestMode, targetProjectIds);

    const plan = buildTodoistImportPlan(files, { projects, tasks });

    if (plan.failedFiles.length > 0 && plan.projects.length === 0) {
      throw new Error(
        `No project in the backup could be parsed: ${plan.failedFiles
          .map((failure) => `${failure.fileName} (${failure.message})`)
          .join("; ")}`,
      );
    }

    return plan;
  };

  const cancelImport = () => {
    setPreview(null);
    setCurrentFileName("");
  };

  const commitImport = async (
    targetPreview: TodoistPreview | null = preview,
    options?: { projectId?: string | null },
  ): Promise<boolean> => {
    if (!targetPreview) return false;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading(
      `Importing ${targetPreview.totalTasks} tasks...`,
    );

    try {
      if (isArchivePreview(targetPreview)) {
        const { importedCount } = await executeTodoistArchiveImport(
          targetPreview,
          {
            isGuest: isGuestMode,
            fileName: currentFileName || "Todoist-backup.zip",
          },
        );

        await refreshWorkspace();

        notify.success(
          `Successfully imported ${importedCount} tasks from Todoist`,
          { id: loadingToastId },
        );
        trigger("success");
        return true;
      }

      const { importedCount } = await executeTodoistImport(targetPreview, {
        projectId: options?.projectId ?? null,
        fileName: currentFileName || "Todoist.csv",
        isGuest: isGuestMode,
      });

      await refreshWorkspace();

      notify.success(
        `Successfully imported ${importedCount} tasks from Todoist`,
        {
          id: loadingToastId,
        },
      );
      trigger("success");
      return true;
    } catch (err) {
      console.error("Failed to import Todoist tasks:", err);
      Sentry.captureException(err);
      notify.error(
        err instanceof TodoistImportFailure
          ? err.message
          : "Critical error during import",
        { id: loadingToastId },
      );
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
      cancelImport();
    }
  };

  return {
    prepareImport,
    commitImport,
    cancelImport,
    preview,
    isImporting,
    fileName: currentFileName,
  };
}
