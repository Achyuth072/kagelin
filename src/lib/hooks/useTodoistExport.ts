"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAuth } from "@/components/AuthProvider";
import { downloadBackup } from "@/lib/backup/export-import";
import type { Project, Task } from "@/lib/types/task";

export function useTodoistExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();
  const queryClient = useQueryClient();

  const exportTodoistZip = async (): Promise<boolean> => {
    setIsExporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading("Exporting Todoist archive...");

    try {
      let cachedTasks: Task[] | undefined;
      let cachedProjects: Project[] | undefined;

      if (!isGuestMode) {
        const tasksQueryData = queryClient.getQueryData<Task[]>([
          "tasks",
          {
            projectId: undefined,
            showCompleted: false,
            filter: "all",
            isGuestMode: false,
          },
        ]);
        const projectsQueryData = queryClient.getQueryData<Project[]>([
          "projects",
          false,
        ]);

        if (tasksQueryData && projectsQueryData) {
          cachedTasks = tasksQueryData;
          cachedProjects = projectsQueryData;
        }
      }

      const mod = await import("@/lib/export/todoistExport");
      const bytes = await mod.exportToTodoistZip({
        isGuest: isGuestMode,
        tasks: cachedTasks,
        projects: cachedProjects,
      });
      const filename = mod.generateTodoistExportFilename();
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: "application/zip",
      });
      downloadBackup(blob, filename);

      notify.success("Todoist archive exported", { id: loadingToastId });
      trigger("success");
      return true;
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Failed to export Todoist archive", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportTodoistZip, isExporting };
}
