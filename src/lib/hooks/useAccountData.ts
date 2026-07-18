"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  createBackupZip,
  parseBackupZip,
  downloadBackup,
} from "@/lib/backup/export-import";
import type { BackupData, BackupMetadata } from "@/lib/backup/types";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { toast } from "sonner";
import pkg from "../../../package.json";

/**
 * Hook for managing registered user data sovereignty (export, import, clear).
 */
export function useAccountData() {
  const { user } = useAuth();
  const supabase = createClient();

  const exportData = async () => {
    if (!user) {
      toast.error("You must be logged in to export cloud data");
      return;
    }

    const promise = async () => {
      // Order by id (unique PK on every table) so .range() pages deterministically
      const fetchTable = <T>(table: string) =>
        fetchAllRows<T>((from, to) =>
          supabase
            .from(table)
            .select("*")
            .order("id", { ascending: true })
            .range(from, to),
        );

      const [tasks, projects, habits, habit_entries, focus_logs, events] =
        await Promise.all([
          fetchTable<BackupData["tasks"][number]>("tasks"),
          fetchTable<BackupData["projects"][number]>("projects"),
          fetchTable<BackupData["habits"][number]>("habits"),
          fetchTable<BackupData["habit_entries"][number]>("habit_entries"),
          fetchTable<BackupData["focus_logs"][number]>("focus_logs"),
          fetchTable<BackupData["events"][number]>("calendar_events"),
        ]);

      const metadata: BackupMetadata = {
        version: 1,
        appVersion: pkg.version,
        exportedAt: new Date().toISOString(),
      };

      const data: BackupData = {
        metadata,
        tasks,
        projects,
        habits,
        habit_entries,
        focus_logs,
        events,
      };

      const blob = await createBackupZip(data);
      downloadBackup(blob);

      return data;
    };

    return toast.promise(promise(), {
      loading: "Preparing your data export...",
      success: "Data exported successfully",
      error: (err) => `Export failed: ${err.message}`,
    });
  };

  const importData = async (file: File) => {
    if (!user) {
      toast.error("You must be logged in to import cloud data");
      return;
    }

    const promise = async () => {
      // 1. Parse ZIP
      const data = await parseBackupZip(file);

      // 2. Validate (Basic check for now)
      if (!data.metadata || !data.tasks) {
        throw new Error("Invalid backup file format: missing essential data");
      }

      // 3. Prepare data for insert with UUID remapping to avoid RLS violations and ID hijacking
      const idMap = new Map<string, string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remapAndPrepare = (items: any[], type: string) => {
        return items.map((item) => {
          const newId = crypto.randomUUID();
          idMap.set(item.id, newId);

          const newItem = { ...item, id: newId };

          // Habit entries do not have a user_id column
          if (type !== "habit_entries") {
            newItem.user_id = user.id;
          }

          // Remap foreign keys
          if (type === "tasks" && item.project_id) {
            newItem.project_id = idMap.get(item.project_id) || item.project_id;
          }
          if (type === "habit_entries" && item.habit_id) {
            newItem.habit_id = idMap.get(item.habit_id) || item.habit_id;
          }

          return newItem;
        });
      };

      // 4. Insert in order of dependency
      // Projects first (tasks depend on them)
      if (data.projects && data.projects.length > 0) {
        const prepared = remapAndPrepare(data.projects, "projects");
        const { error } = await supabase.from("projects").insert(prepared);
        if (error) throw error;
      }

      // Habits first (entries depend on them)
      if (data.habits && data.habits.length > 0) {
        const prepared = remapAndPrepare(data.habits, "habits");
        const { error } = await supabase.from("habits").insert(prepared);
        if (error) throw error;
      }

      // Then the rest
      const remaining = [
        { table: "tasks", items: data.tasks },
        { table: "habit_entries", items: data.habit_entries },
        { table: "focus_logs", items: data.focus_logs },
        { table: "calendar_events", items: data.events },
      ];

      for (const { table, items } of remaining) {
        if (items && items.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prepared = remapAndPrepare(items as any[], table);
          const { error } = await supabase.from(table).insert(prepared);
          if (error) throw error;
        }
      }

      return data;
    };

    return toast.promise(promise(), {
      loading: "Importing your cloud data...",
      success: "Data imported successfully. Please refresh to see changes.",
      error: (err) => `Import failed: ${err.message}`,
    });
  };

  const clearCloudData = async () => {
    if (!user) return;

    const promise = async () => {
      const tables = [
        "tasks",
        "projects",
        "habits",
        "focus_logs",
        "calendar_events",
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id);

        if (error) {
          console.error(`Clear error on table ${table}:`, error);
          throw error;
        }
      }
    };

    return toast.promise(promise(), {
      loading: "Clearing your cloud data...",
      success: "Cloud data cleared successfully",
      error: (err) => `Clear failed: ${err.message}`,
    });
  };

  return {
    exportData,
    importData,
    clearCloudData,
  };
}
