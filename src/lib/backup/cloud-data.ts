import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { useLocationHistoryStore } from "@/lib/store/locationHistoryStore";
import type { BackupData, BackupMetadata } from "./types";
import pkg from "../../../package.json";

// RLS scopes selects to the caller; no user_id filter needed.
export async function collectCloudBackup(
  supabase: SupabaseClient,
): Promise<BackupData> {
  // Order by id so .range() pages deterministically.
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

  return {
    metadata,
    tasks,
    projects,
    habits,
    habit_entries,
    focus_logs,
    events,
    location_history: useLocationHistoryStore.getState().locations,
  };
}

// Parents first to satisfy foreign key constraints.
const RESTORE_ORDER = [
  "projects",
  "habits",
  "tasks",
  "habit_entries",
  "focus_logs",
  "calendar_events",
] as const;

type RestoreTable = (typeof RESTORE_ORDER)[number];

// Chunk writes to avoid PostgREST request body size limits.
const WRITE_BATCH_SIZE = 500;

function batched<T>(items: T[], size = WRITE_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function fetchExistingIds(
  supabase: SupabaseClient,
  table: string,
): Promise<string[]> {
  const rows = await fetchAllRows<{ id: string }>((from, to) =>
    supabase
      .from(table)
      .select("id")
      .order("id", { ascending: true })
      .range(from, to),
  );
  return rows.map((row) => row.id);
}

// Upsert before pruning so a partial failure leaves data recoverable rather than wiped.
// Preserves row IDs so cross-device restores converge instead of duplicating.
export async function replaceCloudBackup(
  supabase: SupabaseClient,
  userId: string,
  data: BackupData,
): Promise<void> {
  const rowsFor = (table: RestoreTable) =>
    (table === "calendar_events" ? data.events : data[table]) ?? [];

  for (const table of RESTORE_ORDER) {
    const rows = rowsFor(table).map((row) =>
      // habit_entries is scoped through habit_id and has no user_id column.
      table === "habit_entries" ? { ...row } : { ...row, user_id: userId },
    );

    const results = await Promise.all(
      batched(rows).map((batch) => supabase.from(table).upsert(batch)),
    );
    for (const { error } of results) {
      if (error) throw error;
    }
  }

  const existingIds = Object.fromEntries(
    await Promise.all(
      RESTORE_ORDER.map(async (table) => [
        table,
        await fetchExistingIds(supabase, table),
      ]),
    ),
  ) as Record<RestoreTable, string[]>;

  // Delete children first to prevent cascading deletes over newly written rows.
  for (const table of [...RESTORE_ORDER].reverse()) {
    const keep = new Set(rowsFor(table).map((row) => row.id));
    const stale = existingIds[table].filter((id) => !keep.has(id));

    const results = await Promise.all(
      batched(stale).map((batch) =>
        supabase.from(table).delete().in("id", batch),
      ),
    );
    for (const { error } of results) {
      if (error) throw error;
    }
  }
}
