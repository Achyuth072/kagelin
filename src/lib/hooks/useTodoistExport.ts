"use client";

import { useState } from "react";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAuth } from "@/components/AuthProvider";
import { downloadBackup } from "@/lib/backup/export-import";

export function useTodoistExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  const exportTodoistZip = async (): Promise<boolean> => {
    setIsExporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading("Exporting Todoist archive...");

    try {
      // Always re-collect: the query cache holds root rows only (no subtask content).
      const mod = await import("@/lib/export/todoistExport");
      const bytes = await mod.exportToTodoistZip({ isGuest: isGuestMode });
      const filename = mod.generateTodoistExportFilename();
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: "application/zip",
      });
      downloadBackup(blob, filename);

      notify.success("Todoist archive exported", { id: loadingToastId });
      trigger("success");
      return true;
    } catch (err) {
      void recordDiagnosticError(err);
      notify.error("Failed to export Todoist archive", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportTodoistZip, isExporting };
}
