import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type {
  DiagnosticErrorRecord,
  DiagnosticStorageInfo,
  DiagnosticServiceWorkerInfo,
  DiagnosticSyncHealthInfo,
} from "@/lib/errors/diagnostics";
import { stripContent } from "./stripContent";

export interface DiagnosticLogEntry {
  timestamp: string;
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
}

// Builds the bundle's Recent Logs from the client diagnostic error buffer.
// Records are pre-scrubbed at write time — no plaintext user content.
export function recentErrorsAsLogs(
  records: DiagnosticErrorRecord[],
): DiagnosticLogEntry[] {
  return records.map((record) => ({
    timestamp: record.timestamp,
    category: "error",
    level: "error",
    message: record.message,
    data: {
      name: record.name,
      digest: record.digest,
      context: record.context,
      stack: record.stack,
    },
  }));
}

export interface DiagnosticPlatformInfo {
  userAgent: string;
  language: string;
  timeZone: string;
  standalone: boolean;
  online: boolean;
  viewport: string;
}

export interface DiagnosticSettingsSnapshot {
  theme: string | undefined;
  timeFormat: string;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  backupReminderEnabled: boolean;
  backupReminderFrequencyDays: number;
  autoLockEnabled: boolean;
  autoLockMinutes: number;
  sortBy: string;
  groupBy: string;
  viewMode: string;
  habitViewMode: string;
  telemetryConsent: string;
}

export interface DiagnosticBundleInput {
  tier: "guest" | "registered" | "premium";
  appVersion: string;
  releaseChannel: string;
  platform: DiagnosticPlatformInfo;
  storage?: DiagnosticStorageInfo;
  serviceWorker?: DiagnosticServiceWorkerInfo;
  syncHealth?: DiagnosticSyncHealthInfo;
  settings: DiagnosticSettingsSnapshot;
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  events: CalendarEvent[];
  logs: DiagnosticLogEntry[];
}

export interface DiagnosticBundle {
  generatedAt: string;
  app: { version: string; releaseChannel: string };
  platform: DiagnosticPlatformInfo;
  account: { tier: "guest" | "registered" | "premium" };
  storage?: DiagnosticStorageInfo;
  serviceWorker?: DiagnosticServiceWorkerInfo;
  syncHealth?: DiagnosticSyncHealthInfo;
  settings: DiagnosticSettingsSnapshot;
  data: {
    counts: {
      tasks: number;
      projects: number;
      habits: number;
      habitEntries: number;
      events: number;
    };
    tasks: Partial<Task>[];
    projects: Partial<Project>[];
    habits: Partial<Habit>[];
    events: Partial<CalendarEvent>[];
  };
  logs: DiagnosticLogEntry[];
}

export function collectDiagnosticBundle(
  input: DiagnosticBundleInput,
): DiagnosticBundle {
  return {
    generatedAt: new Date().toISOString(),
    app: { version: input.appVersion, releaseChannel: input.releaseChannel },
    platform: input.platform,
    account: { tier: input.tier },
    ...(input.storage ? { storage: input.storage } : {}),
    ...(input.serviceWorker ? { serviceWorker: input.serviceWorker } : {}),
    ...(input.syncHealth ? { syncHealth: input.syncHealth } : {}),
    settings: input.settings,
    data: {
      counts: {
        tasks: input.tasks.length,
        projects: input.projects.length,
        habits: input.habits.length,
        habitEntries: input.habitEntries.length,
        events: input.events.length,
      },
      tasks: input.tasks.map((t) => stripContent("tasks", t)),
      projects: input.projects.map((p) => stripContent("projects", p)),
      habits: input.habits.map((h) => stripContent("habits", h)),
      events: input.events.map((e) => stripContent("calendar_events", e)),
    },
    logs: input.logs,
  };
}
