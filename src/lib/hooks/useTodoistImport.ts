"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import {
  prepareTodoistImport,
  executeTodoistImport,
  type TodoistImportPreview,
} from "@/lib/import/todoist/importTodoist";

export function useTodoistImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<TodoistImportPreview | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const { trigger } = useHaptic();
  const queryClient = useQueryClient();

  const prepareImport = async (
    file: File,
  ): Promise<TodoistImportPreview | null> => {
    setIsImporting(true);
    trigger("toggle");
    try {
      const text = await file.text();
      const result = prepareTodoistImport(text);

      if (result.totalTasks === 0) {
        notify.error("No valid tasks found in Todoist CSV");
        trigger("thud");
        return null;
      }

      setCurrentFileName(file.name);
      setPreview(result);
      return result;
    } catch (err) {
      console.error("Failed to parse Todoist CSV:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to parse Todoist CSV";
      notify.error(msg);
      trigger("thud");
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  const cancelImport = () => {
    setPreview(null);
    setCurrentFileName("");
  };

  const commitImport = async (
    targetPreview: TodoistImportPreview | null = preview,
    options?: { projectId?: string | null },
  ): Promise<boolean> => {
    if (!targetPreview) return false;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading(
      `Importing ${targetPreview.totalTasks} tasks...`,
    );

    try {
      const { importedCount } = await executeTodoistImport(targetPreview, {
        projectId: options?.projectId ?? null,
        fileName: currentFileName || "Todoist.csv",
      });

      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      notifyLocalEdit();

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
      notify.error("Critical error during import", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
      setPreview(null);
      setCurrentFileName("");
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
