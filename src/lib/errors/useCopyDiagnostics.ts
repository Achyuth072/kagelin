"use client";

import { useEffect, useRef, useState } from "react";
import { exportDiagnosticReport } from "@/lib/errors/diagnostics";

// Clipboard feedback shared by the crash screens and the Settings export.
export function useCopyDiagnostics(currentError?: unknown) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const copyDiagnostics = async (): Promise<boolean> => {
    try {
      const report = await exportDiagnosticReport(currentError);
      await navigator.clipboard.writeText(report);
    } catch {
      return false;
    }
    setCopied(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    return true;
  };

  return { copied, copyDiagnostics };
}
