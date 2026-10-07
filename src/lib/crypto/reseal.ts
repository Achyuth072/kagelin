/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRawClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { needsEncryption, isJsonField } from "@/lib/supabase/wrapClient";
import {
  decryptField,
  encryptField,
  isCiphertext,
} from "@/lib/crypto/contentCipher";
import { INITIAL_KEY_ID, needsReseal } from "@/lib/crypto/envelope";
import { keyStore, type Keyring } from "@/lib/crypto/keyStore";
import { keyForEnvelope } from "@/lib/crypto/keyring";
import {
  sourceBinding,
  type EncryptedNotificationBody,
} from "@/lib/notifications";

export interface ResealProgress {
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

// Plaintext, `-v1` and retired-key values all need sealing; null JSON/text has nothing to seal.
function valueNeedsSealing(
  table: string,
  field: string,
  value: unknown,
  currentKeyId: string,
): boolean {
  return (
    needsEncryption(table, field, value) ||
    (isCiphertext(value) && needsReseal(value, currentKeyId))
  );
}

// Absent before the key is cached (first-time setup), when only plaintext can be pending.
async function currentKeyId(userId: string): Promise<string> {
  return (await keyStore.loadKeyring(userId))?.keyId ?? INITIAL_KEY_ID;
}

// Raw client avoids decrypt-on-select to distinguish ciphertext from plaintext.
export async function findPendingRows(userId: string): Promise<PendingRow[]> {
  const raw = createRawClient();
  const pending: PendingRow[] = [];
  const keyId = await currentKeyId(userId);

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
      if (
        fields.some((field) =>
          valueNeedsSealing(table, field, row[field], keyId),
        )
      ) {
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

const isLive = (status: string) =>
  status === "pending" || status === "processing";

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
    if (isLive(row.status)) {
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

const SEALED_PAYLOAD_FIELDS = [
  ["encryptedTitle", "title"],
  ["encrypted", "body"],
] as const;

type SealedPayloadKey = (typeof SEALED_PAYLOAD_FIELDS)[number][0];

interface QueueRow {
  id: string;
  status: string;
  payload: Partial<Record<SealedPayloadKey, EncryptedNotificationBody>> & {
    data?: unknown;
  };
}

function sealedCopies(row: QueueRow) {
  return SEALED_PAYLOAD_FIELDS.flatMap(([key, role]) => {
    const copy = row.payload?.[key];
    return typeof copy?.ciphertext === "string" ? [{ key, role, copy }] : [];
  });
}

function queueRowNeedsWork(row: QueueRow, keyId: string): boolean {
  return sealedCopies(row).some(
    ({ copy }) => !isLive(row.status) || needsReseal(copy.ciphertext, keyId),
  );
}

export async function findPendingQueueRows(
  userId: string,
  keyId: string,
): Promise<QueueRow[]> {
  const raw = createRawClient();
  const rows = await fetchAllRows<QueueRow>((from, to) =>
    (raw.from("notification_queue") as any)
      .select("id,status,payload")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  return rows.filter((row) => queueRowNeedsWork(row, keyId));
}

// Pending copies are re-sealed bound to their source row; the rest are stripped so a retired
// key cannot open them. A copy that cannot be opened is dropped too: the notification falls
// back to its generic copy instead of blocking the whole Re-seal.
async function resealNotificationQueue(
  userId: string,
  ring: Keyring,
): Promise<number> {
  const raw = createRawClient();
  const rows = await findPendingQueueRows(userId, ring.keyId);
  for (const row of rows) {
    const payload = { ...row.payload };
    for (const { key, role, copy } of sealedCopies(row)) {
      const { ciphertext, template } = copy;
      const binding = sourceBinding(userId, row.payload.data, role);
      const openingKey = keyForEnvelope(ring, ciphertext);
      if (!isLive(row.status) || !binding || !openingKey) {
        delete payload[key];
        continue;
      }
      try {
        const plaintext = await decryptField(openingKey, ciphertext, binding);
        payload[key] = {
          template,
          ciphertext: await encryptField(
            ring.key,
            plaintext,
            binding,
            ring.keyId,
          ),
        };
      } catch {
        delete payload[key];
      }
    }

    const { data, error } = await (raw.from("notification_queue") as any)
      .update({ payload })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        `Re-seal conflict: notification ${row.id} changed during the Re-seal. Retrying will pick it up.`,
      );
    }
  }
  return rows.length;
}

export interface UnreadableValue {
  table: string;
  id: string;
  column: string;
}

export interface ResealResult {
  unreadable: UnreadableValue[];
  // Rows and queued notifications rewritten; zero means the pass found nothing else to do.
  sealed: number;
}

// Re-seals every value not yet in the current scheme under the current key,
// bound to its row; plaintext is the special case with nothing to open first.
// A value that cannot be opened (tampered, moved, corrupted or under a key this device
// does not hold) is left as it is and returned, so the pass still finishes every other row.
export async function runReseal(
  userId: string,
  onProgress?: (progress: ResealProgress) => void,
  signal?: AbortSignal,
): Promise<ResealResult> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) {
    throw new Error("Cannot re-seal: the content key is unavailable.");
  }

  signal?.throwIfAborted();
  await redactLegacyPlaintextNotifications(userId);
  await scrubLegacyDiagnosticText(userId);

  const raw = createRawClient();
  const pending = await findPendingRows(userId);
  const total = pending.length;
  onProgress?.({ done: 0, total, table: pending[0]?.table ?? "" });

  const CONCURRENCY = 10;
  let done = 0;
  const unreadable: UnreadableValue[] = [];

  const migrateRow = async ({ table, id, updatedAt, row }: PendingRow) => {
    const fields = FIELD_MAP[table];
    const patch: Record<string, string> = {};
    await Promise.all(
      fields.map(async (field) => {
        const value = row[field];
        if (!valueNeedsSealing(table, field, value, ring.keyId)) return;
        const binding = { userId, table, column: field, rowId: id };
        let plaintext: string;
        if (isCiphertext(value)) {
          const openingKey = keyForEnvelope(ring, value);
          const opened = openingKey
            ? await decryptField(openingKey, value, binding).catch(() => null)
            : null;
          if (opened === null) {
            unreadable.push({ table, id, column: field });
            return;
          }
          plaintext = opened;
        } else {
          plaintext = isJsonField(table, field)
            ? JSON.stringify(value)
            : (value as string);
        }
        patch[field] = await encryptField(
          ring.key,
          plaintext,
          binding,
          ring.keyId,
        );
      }),
    );
    if (Object.keys(patch).length === 0) return;

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
        `Re-seal conflict: ${table} row ${id} changed during the Re-seal. Retrying will pick it up.`,
      );
    }

    done++;
    onProgress?.({ done, total, table });
  };

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    signal?.throwIfAborted();
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(migrateRow));
  }

  signal?.throwIfAborted();
  const queueSealed = await resealNotificationQueue(userId, ring);
  return { unreadable, sealed: done + queueSealed };
}
