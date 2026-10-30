"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  HardDrive,
  Keyboard,
  Sliders,
  Bell,
  Lock,
  Download,
  Loader2,
  HelpCircle,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore, type GoalsState } from "@/lib/store/uiStore";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useAccountData } from "@/lib/hooks/useAccountData";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { formatModChord } from "@/lib/utils/platform";
import { mockStore } from "@/lib/mock/mock-store";
import { buildGuestBackupData } from "@/components/settings/BackupSyncSettings";
import { createBackupZip, downloadBackup } from "@/lib/backup/export-import";
import { notify } from "@/lib/notify";
import type { BackupData } from "@/lib/backup/types";

interface SettingsContextRailProps {
  activeTab: "appearance" | "preferences" | "account";
  isGuestMode?: boolean;
  userEmail?: string | null;
  goals?: GoalsState;
  onOpenSection?: (sectionId: string) => void;
}

export function SettingsContextRail({
  activeTab,
  isGuestMode = true,
  userEmail,
  goals,
  onOpenSection,
}: SettingsContextRailProps) {
  const { trigger } = useHaptic();
  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );
  const { exportData } = useAccountData();
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    requestPermission: requestPushPermission,
    showNotification,
  } = usePushNotifications();

  // Account rail state
  const [isExporting, setIsExporting] = useState(false);
  const [guestCounts, setGuestCounts] = useState({
    habits: 0,
    tasks: 0,
    focusLogs: 0,
  });

  // Load guest counts when on account tab
  useEffect(() => {
    if (activeTab !== "account" || !isGuestMode) return;
    try {
      setGuestCounts({
        habits: mockStore.getHabits().filter((h) => !h.archived_at).length,
        tasks: mockStore.getTasks().filter((t) => !t.is_completed).length,
        focusLogs: mockStore.getFocusLogs().length,
      });
    } catch {
      // Fallback silently if mock store is unavailable
    }
  }, [activeTab, isGuestMode]);

  if (activeTab === "appearance") {
    return null;
  }

  // Functional One-Click Backup Export
  const handleDownloadBackup = async () => {
    trigger("thud");
    setIsExporting(true);
    try {
      if (isGuestMode) {
        const backupData: BackupData = buildGuestBackupData();
        const zipBlob = await createBackupZip(backupData);
        downloadBackup(zipBlob);
        notify.success("Backup archive downloaded successfully");
      } else {
        await exportData();
      }
    } catch {
      notify.error("Failed to generate backup archive");
    } finally {
      setIsExporting(false);
    }
  };

  const renderExportButton = (label: string) => (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownloadBackup}
      disabled={isExporting}
      aria-busy={isExporting}
      className="w-full h-8 text-xs font-medium border-border/80 hover:bg-secondary/40 transition-seijaku-fast gap-1.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isExporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </Button>
  );

  // Functional Test Desktop Notification
  const handleTestNotification = async () => {
    trigger("toggle");
    if (!pushSupported) {
      notify.error("Desktop notifications are not supported in this browser");
      return;
    }

    if (pushPermission !== "granted") {
      const res = await requestPushPermission();
      if (res.permission !== "granted") {
        notify.warning(
          "Notification permission was denied. Please allow notifications in browser settings.",
        );
        return;
      }
    }

    const success = await showNotification("Kagelin Alert", {
      body: "Desktop notifications are working as expected.",
      icon: "/icons/icon-192.png",
    });

    if (success) {
      notify.info("Desktop test alert sent to system notification center");
    } else {
      notify.error(
        "Could not trigger desktop notification. Check OS alert settings.",
      );
    }
  };

  const activeGoalsCount = [
    goals?.dailyFocusHours,
    goals?.weeklyFocusHours,
    goals?.dailyTasksCompleted,
    goals?.weeklyTasksCompleted,
  ].filter((g) => g != null).length;

  return (
    <aside
      className="hidden xl:flex flex-col gap-5 w-80 2xl:w-88 shrink-0 sticky top-6 self-start max-h-[calc(100dvh-5rem)] overflow-y-auto scrollbar-hide animate-in fade-in-50 duration-150"
      aria-label="Settings overview and tools"
    >
      {/* ─────────────────────────────────────────────────────────────
          PREFERENCES TAB RAIL: SIGNALS & SHORTCUTS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "preferences" && (
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sliders className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            <span>Signals & Shortcuts</span>
          </h2>

          {/* Desktop Push Notification Controller */}
          <section
            className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-3"
            aria-label="Desktop notifications"
          >
            <div className="flex items-center justify-between">
              <h3 className="type-ui font-medium text-foreground">
                Desktop Notifications
              </h3>
              <Bell
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            <div className="p-2 rounded-lg bg-secondary/40 border border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Permission</span>
              <span
                className={cn(
                  "font-mono capitalize font-medium flex items-center gap-1.5",
                  pushPermission === "granted" &&
                    "text-emerald-700 dark:text-emerald-400",
                  pushPermission === "denied" && "text-destructive",
                  pushPermission !== "granted" &&
                    pushPermission !== "denied" &&
                    "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    pushPermission === "granted" &&
                      "bg-emerald-600 dark:bg-emerald-500",
                    pushPermission === "denied" && "bg-destructive",
                    pushPermission !== "granted" &&
                      pushPermission !== "denied" &&
                      "bg-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                {!pushSupported ? "Unsupported" : pushPermission}
              </span>
            </div>

            {pushSupported && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                className="w-full h-8 text-xs font-medium border-border/80 hover:bg-secondary/40 transition-seijaku-fast focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pushPermission === "granted"
                  ? "Send Desktop Test Alert"
                  : "Enable & Test Alert"}
              </Button>
            )}

            <p className="type-micro text-muted-foreground leading-relaxed">
              Triggers real OS notifications for timer transitions and scheduled
              daily reminders.
            </p>
          </section>

          {/* Productivity Targets Snapshot */}
          <section
            className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-2.5"
            aria-label="Productivity targets snapshot"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="type-ui font-medium text-foreground">
                  Target Rings
                </h3>
                <span className="type-micro font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {activeGoalsCount}/4
                </span>
              </div>
              {onOpenSection && (
                <button
                  type="button"
                  onClick={() => {
                    trigger("toggle");
                    onOpenSection("goals");
                  }}
                  className="type-micro text-brand hover:underline font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
                >
                  Edit Targets
                </button>
              )}
            </div>

            <dl className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 divide-y divide-border/30 text-xs">
              <div className="flex items-center justify-between py-1.5 first:pt-0">
                <dt className="text-muted-foreground">Daily Focus</dt>
                <dd className="font-mono font-medium text-foreground">
                  {goals?.dailyFocusHours != null
                    ? `${goals.dailyFocusHours} hrs`
                    : "Off"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <dt className="text-muted-foreground">Weekly Focus</dt>
                <dd className="font-mono font-medium text-foreground">
                  {goals?.weeklyFocusHours != null
                    ? `${goals.weeklyFocusHours} hrs`
                    : "Off"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <dt className="text-muted-foreground">Daily Tasks</dt>
                <dd className="font-mono font-medium text-foreground">
                  {goals?.dailyTasksCompleted != null
                    ? `${goals.dailyTasksCompleted} tasks`
                    : "Off"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1.5 last:pb-0">
                <dt className="text-muted-foreground">Weekly Tasks</dt>
                <dd className="font-mono font-medium text-foreground">
                  {goals?.weeklyTasksCompleted != null
                    ? `${goals.weeklyTasksCompleted} tasks`
                    : "Off"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Workspace Shortcuts Reference */}
          <section
            className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2.5"
            aria-label="Keyboard shortcuts"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Keyboard
                  className="h-3.5 w-3.5 text-brand"
                  aria-hidden="true"
                />
                <span>Quick Hotkeys</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  trigger("toggle");
                  setShortcutsHelpOpen(true);
                }}
                className="type-micro text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
                title="View all shortcuts (?)"
                aria-label="View all keyboard shortcuts"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All (?)</span>
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-2 type-micro text-muted-foreground pt-1">
              {[
                { key: "1", label: "Tasks" },
                { key: "2", label: "Habits" },
                { key: "3", label: "Calendar" },
                { key: "4", label: "Stats" },
                { key: "5", label: "Focus" },
                { key: "6", label: "Settings" },
                { key: formatModChord("K"), label: "Palette" },
                { key: "?", label: "Help" },
              ].map(({ key, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <kbd className="pointer-events-none h-6.5 min-w-[28px] select-none inline-flex items-center justify-center rounded border border-border bg-transparent px-2 font-mono text-[13px] tracking-[0.01em] text-foreground shadow-none">
                    {key}
                  </kbd>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ACCOUNT TAB RAIL: DATA HEALTH & PORTABILITY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "account" && (
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck
              className="h-3.5 w-3.5 text-brand"
              aria-hidden="true"
            />
            <span>Account & Data Health</span>
          </h2>

          {/* GUEST MODE SPECIFIC */}
          {isGuestMode ? (
            <>
              {/* Local Storage Engine & Quick Export */}
              <section
                className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-3"
                aria-label="Local session storage"
              >
                <div className="flex items-center justify-between">
                  <h3 className="type-ui font-medium text-foreground">
                    Local Storage Engine
                  </h3>
                  <HardDrive
                    className="h-3.5 w-3.5 text-brand"
                    aria-hidden="true"
                  />
                </div>

                <dl className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 divide-y divide-border/30 text-xs">
                  <div className="flex items-center justify-between py-1.5 first:pt-0">
                    <dt className="text-muted-foreground">Active Habits</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {guestCounts.habits}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-muted-foreground">Pending Tasks</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {guestCounts.tasks}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-muted-foreground">Focus Logs</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {guestCounts.focusLogs}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 last:pb-0">
                    <dt className="text-muted-foreground">Storage Engine</dt>
                    <dd className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      IndexedDB (Local)
                    </dd>
                  </div>
                </dl>

                {/* Direct One-Click Backup Download */}
                {renderExportButton("Export Snapshot (.zip)")}

                {onOpenSection && (
                  <button
                    type="button"
                    onClick={() => {
                      trigger("toggle");
                      onOpenSection("backup");
                    }}
                    className="w-full text-center type-micro text-brand hover:underline font-medium pt-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
                  >
                    Open Backup & Import Tools →
                  </button>
                )}

                <p className="type-micro text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                  Data resides locally within this browser profile. Export a
                  backup before clearing browser cache or cookies.
                </p>
              </section>

              {/* Data Safety Card */}
              <section
                className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2"
                aria-label="Local data persistence"
              >
                <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>Local-First Persistence</span>
                </h3>
                <p className="type-micro text-muted-foreground leading-relaxed">
                  Your data never leaves your device without your explicit
                  action. Backups use standard JSON archives inside encrypted
                  ZIP containers.
                </p>
              </section>
            </>
          ) : (
            /* REGISTERED USER SPECIFIC */
            <>
              {/* Authenticated Cloud Vault */}
              <section
                className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-3"
                aria-label="Cloud account status"
              >
                <div className="flex items-center justify-between">
                  <h3 className="type-ui font-medium text-foreground">
                    Cloud Account
                  </h3>
                  <Activity
                    className="h-3.5 w-3.5 text-brand"
                    aria-hidden="true"
                  />
                </div>

                <dl className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 divide-y divide-border/30 text-xs">
                  <div className="flex items-center justify-between py-1.5 first:pt-0">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="font-mono text-foreground truncate max-w-[150px]">
                      {userEmail || "Registered"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-muted-foreground">Sync Tier</dt>
                    <dd className="font-semibold text-brand">
                      Cloud Persisted
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 last:pb-0">
                    <dt className="text-muted-foreground">Multi-Device</dt>
                    <dd className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500"
                        aria-hidden="true"
                      />
                      Active
                    </dd>
                  </div>
                </dl>

                {/* Direct Archive Export */}
                {renderExportButton("Export Account Archive (.zip)")}

                <p className="type-micro text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                  Habit streaks, tasks, and focus logs sync continuously across
                  all authenticated devices.
                </p>
              </section>

              {/* Zero-Knowledge Encryption Card */}
              <section
                className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2"
                aria-label="Encryption status"
              >
                <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  <span>Zero-Knowledge Vault</span>
                </h3>
                <p className="type-micro text-muted-foreground leading-relaxed">
                  Client-side keys protect your habit notes and task contents
                  with AES-GCM row-bound encryption before transmission.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
