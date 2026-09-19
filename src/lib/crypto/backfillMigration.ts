/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRawClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { needsEncryption, isJsonField } from "@/lib/supabase/wrapClient";
import { encryptField } from "@/lib/crypto/contentCipher";
import { keyStore } from "@/lib/crypto/keyStore";

export interface MigrationProgress {
  done: number;
  total: number;
  table: string;
}

interface PendingRow {
  table: string;
  id: string;
  updatedAt: string | null;
  row: Record<string, any>;
}

const TABLES_WITH_UPDATED_AT = new Set([
  "tasks",
  "habits",
  "projects",
  "calendar_events",
  "external_calendars",
]);

// Keeps the habit_id list in each request URL well under PostgREST's limit.
const HABIT_ID_CHUNK = 100;

async function fetchOwnedRows(
  raw: ReturnType<typeof createRawClient>,
  table: string,
  columns: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  if (table !== "habit_entries") {
    return fetchAllRows<Record<string, unknown>>((from, to) =>
      (raw.from(table) as any)
        .select(columns)
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to),
    );
  }

  // habit_entries has no user_id column; ownership runs through the parent habit.
  const habits = await fetchAllRows<{ id: string }>((from, to) =>
    (raw.from("habits") as any)
      .select("id")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < habits.length; i += HABIT_ID_CHUNK) {
    const habitIds = habits.slice(i, i + HABIT_ID_CHUNK).map((h) => h.id);
    rows.push(
      ...(await fetchAllRows<Record<string, unknown>>((from, to) =>
        (raw.from(table) as any)
          .select(columns)
          .in("habit_id", habitIds)
          .order("id", { ascending: true })
          .range(from, to),
      )),
    );
  }
  return rows;
}

// Raw client avoids decrypt-on-select to distinguish ciphertext from plaintext.
export async function findPendingRows(userId: string): Promise<PendingRow[]> {
  const raw = createRawClient();
  const pending: PendingRow[] = [];

  for (const [table, fields] of Object.entries(FIELD_MAP)) {
    if (!fields.length) continue;
    const hasUpdatedAt = TABLES_WITH_UPDATED_AT.has(table);
    const columns = [
      "id",
      ...(hasUpdatedAt ? ["updated_at"] : []),
      ...fields,
    ].join(",");
    const rows = await fetchOwnedRows(raw, table, columns, userId);

    for (const row of rows) {
      if (fields.some((field) => needsEncryption(table, field, row[field]))) {
        pending.push({
          table,
          id: row.id as string,
          updatedAt: hasUpdatedAt ? (row.updated_at as string) : null,
          row,
        });
      }
    }
  }

  return pending;
}

// Evening and briefing notifications never carry user content (ADR 0016).
const CONTENT_NOTIFICATION_TYPES = ["due_date", "do_date", "timer_end"];

const LEGACY_NOTIFICATION_BODIES: Record<string, string> = {
  due_date: "You have a task due now.",
  do_date: "You have a task scheduled now.",
  timer_end: "Your timer is complete.",
};

// Pre-composed bodies that never contained plaintext task titles.
const CONTENT_FREE_NOTIFICATION_BODIES = new Set([
  ...Object.values(LEGACY_NOTIFICATION_BODIES),
  "Your focus session is complete. Take a break!",
  "Your break is over. Time to focus!",
]);

// Overwrite plaintext task titles in legacy notification bodies.
async function redactLegacyPlaintextNotifications(
  userId: string,
): Promise<void> {
  const raw = createRawClient();
  const rows = await fetchAllRows<{
    id: string;
    type: string;
    status: string;
    payload: Record<string, any>;
  }>((from, to) =>
    (raw.from("notification_queue") as any)
      .select("id,type,status,payload")
      .eq("user_id", userId)
      .in("type", CONTENT_NOTIFICATION_TYPES)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const stale = rows.filter(
    (row) =>
      !row.payload?.encrypted &&
      !CONTENT_FREE_NOTIFICATION_BODIES.has(row.payload?.body),
  );
  if (stale.length === 0) return;

  for (const row of stale) {
    const redacted = {
      title: row.payload?.title ?? "Kagelin",
      body: LEGACY_NOTIFICATION_BODIES[row.type],
      data: row.payload?.data ?? {},
    };
    const patch: Record<string, unknown> = { payload: redacted };
    // Prevent pending notifications from delivering generic copy.
    if (row.status === "pending" || row.status === "processing") {
      patch.status = "cancelled";
    }

    const { error } = await (raw.from("notification_queue") as any)
      .update(patch)
      .eq("id", row.id);
    if (error) throw error;
  }
}

// Diagnostic fields predating ADR 0016 redaction may contain plaintext.
async function scrubLegacyDiagnosticText(userId: string): Promise<void> {
  const raw = createRawClient();
  const { error: calendarError } = await (raw.from("external_calendars") as any)
    .update({ sync_error: null })
    .eq("user_id", userId)
    .not("sync_error", "is", null);
  if (calendarError) throw calendarError;

  const { error: notificationError } = await (
    raw.from("notification_queue") as any
  )
    .update({ error_message: null })
    .eq("user_id", userId)
    .not("error_message", "is", null);
  if (notificationError) throw notificationError;
}

export async function runBackfillMigration(
  userId: string,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<void> {
  const masterKey = await keyStore.load(userId);
  if (!masterKey) {
    throw new Error("Cannot migrate: the content key is unavailable.");
  }

  await redactLegacyPlaintextNotifications(userId);
  await scrubLegacyDiagnosticText(userId);

  const raw = createRawClient();
  const pending = await findPendingRows(userId);
  const total = pending.length;
  onProgress?.({ done: 0, total, table: pending[0]?.table ?? "" });

  const CONCURRENCY = 10;
  let done = 0;

  const migrateRow = async ({ table, id, updatedAt, row }: PendingRow) => {
    const fields = FIELD_MAP[table];
    const patch: Record<string, string> = {};
    await Promise.all(
      fields.map(async (field) => {
        const value = row[field];
        if (!needsEncryption(table, field, value)) return;
        const plaintext = isJsonField(table, field)
          ? JSON.stringify(value)
          : (value as string);
        patch[field] = await encryptField(masterKey, plaintext);
      }),
    );

    // Avoid overwriting concurrent writes with stale ciphertext.
    let query = (raw.from(table) as any)
      .update(patch)
      .eq("id", id)
      .select("id");
    if (updatedAt !== null) {
      query = query.eq("updated_at", updatedAt);
    } else {
      // JSON columns can't be matched with eq; their siblings still guard.
      for (const field of Object.keys(patch)) {
        if (!isJsonField(table, field)) query = query.eq(field, row[field]);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        `Migration conflict: ${table} row ${id} changed during migration. Retrying will pick it up.`,
      );
    }

    done++;
    onProgress?.({ done, total, table });
  };

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(migrateRow));
  }
}
