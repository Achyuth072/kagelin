"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { notify } from "@/lib/notify";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { useUiStore } from "@/lib/store/uiStore";
import type { BackupData } from "@/lib/backup/types";

const STORAGE_KEY = "kanso_last_backup_date";
const SESSION_KEY = "kanso_backup_prompted";

/** Prompts guest users to back up weekly via a dismissible toast, not a modal. */
export function useWeeklyBackup() {
  const { isGuestMode } = useAuth();
  const backupReminderEnabled = useUiStore((s) => s.backupReminderEnabled);
  const backupReminderFrequencyDays = useUiStore(
    (s) => s.backupReminderFrequencyDays,
  );
  const hasPrompted = useRef(false);

  const lastBackupDate = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Date(stored) : null;
  }, []);

  const updateLastBackupDate = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  }, []);

  const triggerBackup = useCallback(async () => {
    try {
      const backupData: BackupData = {
        metadata: {
          version: 1,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.14.3",
          exportedAt: new Date().toISOString(),
        },
        tasks: mockStore.getTasks(),
        projects: mockStore.getProjects(),
        habits: mockStore.getHabits(),
        habit_entries: mockStore.getHabitEntries(),
        focus_logs: mockStore.getFocusLogs(),
        events: mockStore.getEvents(),
      };

      const { createBackupZip, downloadBackup } =
        await import("@/lib/backup/export-import");
      const blob = await createBackupZip(backupData);
      downloadBackup(blob);

      updateLastBackupDate();

      notify.success("Backup downloaded successfully");
    } catch (error) {
      console.error("Backup failed:", error);
      notify.error("Failed to create backup");
    }
  }, [updateLastBackupDate]);

  useEffect(() => {
    if (!isGuestMode) return;
    if (!backupReminderEnabled) return;
    if (hasPrompted.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY))
      return;

    const frequencyMs = backupReminderFrequencyDays * 24 * 60 * 60 * 1000;
    const isStale =
      !lastBackupDate || Date.now() - lastBackupDate.getTime() > frequencyMs;

    if (isStale) {
      // Delay so this doesn't interrupt initial page load.
      const timeoutId = setTimeout(() => {
        // Set flags only after the toast actually shows, so Strict Mode's
        // double-invoke doesn't skip it.
        hasPrompted.current = true;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_KEY, "true");
        }

        notify(
          "It's been a while since your last backup — back up now to prevent loss",
          {
            duration: 10000,
            action: {
              label: "Back Up Now",
              onClick: () => {
                triggerBackup();
              },
            },
          },
        );
      }, 3000);

      return () => clearTimeout(timeoutId);
    }
  }, [
    isGuestMode,
    backupReminderEnabled,
    backupReminderFrequencyDays,
    lastBackupDate,
    triggerBackup,
  ]);

  return {
    lastBackupDate,
    triggerBackup,
    updateLastBackupDate,
  };
}
