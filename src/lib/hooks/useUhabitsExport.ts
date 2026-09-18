"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { downloadBackup } from "@/lib/backup/export-import";

export function useUhabitsExport() {
  const [isExportingDb, setIsExportingDb] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const { trigger } = useHaptic();

  const runExport = async ({
    setLoading,
    load,
    mimeType,
    loadingMessage,
    successMessage,
    errorMessage,
  }: {
    setLoading: (val: boolean) => void;
    load: () => Promise<{ bytes: Uint8Array; filename: string }>;
    mimeType: string;
    loadingMessage: string;
    successMessage: string;
    errorMessage: string;
  }): Promise<boolean> => {
    setLoading(true);
    trigger("toggle");
    const loadingToastId = notify.loading(loadingMessage);

    try {
      const { bytes, filename } = await load();
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: mimeType,
      });
      downloadBackup(blob, filename);

      notify.success(successMessage, { id: loadingToastId });
      trigger("success");
      return true;
    } catch (err) {
      Sentry.captureException(err);
      notify.error(errorMessage, { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const exportLoopDb = () =>
    runExport({
      setLoading: setIsExportingDb,
      load: async () => {
        const mod = await import("@/lib/export/uhabitsExportDb");
        return {
          bytes: await mod.exportToUhabitsDb(),
          filename: mod.generateUhabitsDbFilename(),
        };
      },
      mimeType: "application/x-sqlite3",
      loadingMessage: "Exporting Loop database...",
      successMessage: "Loop database exported",
      errorMessage: "Failed to export Loop database",
    });

  const exportLoopZip = () =>
    runExport({
      setLoading: setIsExportingZip,
      load: async () => {
        const mod = await import("@/lib/export/uhabitsExportCsv");
        return {
          bytes: await mod.exportToUhabitsZip(),
          filename: mod.generateUhabitsZipFilename(),
        };
      },
      mimeType: "application/zip",
      loadingMessage: "Exporting Loop CSV archive...",
      successMessage: "Loop CSV archive exported",
      errorMessage: "Failed to export Loop CSV archive",
    });

  return {
    exportLoopDb,
    exportLoopZip,
    isExportingDb,
    isExportingZip,
    isExporting: isExportingDb || isExportingZip,
  };
}
