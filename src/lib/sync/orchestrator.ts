/**
 * Sync Orchestrator Service
 * Handles the high-level sync flow for any provider using the SyncAdapter interface.
 */

import "./register-adapters";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  UpdateExternalCalendarInput,
} from "@/lib/types/external-calendar";
import {
  getAdapter,
  type SyncResult,
  type SyncAdapter,
  type SyncAdapterConfig,
  type RemoteEvent,
} from "./adapter-interface";
import { computePullMutations, type PullMutations } from "./pull-merge";

/**
 * Perform a full sync for an external calendar
 */
export async function syncExternalCalendar(
  calendarId: string,
  config: Partial<SyncAdapterConfig> = {},
): Promise<SyncResult> {
  const supabase = createClient();
  const result: SyncResult = {
    created: 0,
    updated: 0,
    archived: 0,
    pushed: 0,
    errors: [],
    newSyncToken: null,
  };

  try {
    // 1. Fetch calendar metadata from DB
    const { data: calendar, error: calError } = await supabase
      .from("external_calendars")
      .select("*")
      .eq("id", calendarId)
      .single();

    if (calError || !calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    const adapter = getAdapter(calendar.provider);

    // 2. Initialize adapter
    await adapter.initialize({
      externalCalendar: calendar,
      ...config,
    });

    // 3. Mark as syncing in DB
    await updateCalendarStatus(calendarId, { sync_status: "syncing" });

    // 4. Determine sync type (incremental vs full)
    let remoteEvents: RemoteEvent[] = [];
    let deletedRemoteIds: string[] = [];
    let newSyncToken = "";

    if (calendar.sync_token) {
      try {
        const delta = await adapter.incrementalSync(calendar.sync_token);
        remoteEvents = delta.updated;
        deletedRemoteIds = delta.deleted;
        newSyncToken = delta.newSyncToken;
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "SYNC_TOKEN_EXPIRED") {
          // Fallback to full sync
          const full = await adapter.fullSync();
          remoteEvents = full.events;
          newSyncToken = full.syncToken;
        } else {
          throw e;
        }
      }
    } else {
      const full = await adapter.fullSync();
      remoteEvents = full.events;
      newSyncToken = full.syncToken;
    }

    // 5. Fetch local events for this calendar
    const { data: localEvents, error: localError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("remote_calendar_id", calendarId);

    if (localError) throw localError;

    // 6. Compute and apply pull mutations (LWW + kansoId adoption)
    const incoming = remoteEvents
      .map((remote) => {
        const parsed = adapter.parseRemoteEvent(remote);
        if (!parsed) return null;
        return {
          remoteId: remote.remoteId,
          etag: remote.etag,
          updatedAt: remote.updatedAt ?? new Date(),
          kansoId: remote.kansoId,
          parsed,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const mutations = computePullMutations(
      (localEvents as CalendarEvent[]) ?? [],
      incoming,
      deletedRemoteIds,
    );

    const pullResult = await applyPullMutations(mutations, calendar);
    result.created += pullResult.created;
    result.updated += pullResult.updated;
    result.archived += pullResult.archived;
    result.errors.push(...pullResult.errors);

    // 7. Push local changes (sync_state IS NOT NULL) for bidirectional calendars
    if (calendar.sync_direction === "bidirectional") {
      const pushResult = await pushPendingEvents(calendar, adapter);
      result.pushed += pushResult.pushed;
      result.errors.push(...pushResult.errors);
    }

    // 8. Finalize status and sync token
    result.newSyncToken = newSyncToken;
    await updateCalendarStatus(calendarId, {
      sync_status: result.errors.length > 0 ? "error" : "success",
      sync_error: result.errors.length > 0 ? result.errors[0] : undefined,
      sync_token: newSyncToken,
      last_sync_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    result.errors.push(message);
    await updateCalendarStatus(calendarId, {
      sync_status: "error",
      sync_error: message,
    });
  }

  return result;
}

/**
 * Push all locally-queued changes (sync_state IS NOT NULL) to the remote provider.
 * Implements the drain rule: if updated_at advanced during the push (concurrent edit),
 * the sync_state is kept as 'pending_update' rather than cleared.
 */
export async function pushPendingEvents(
  calendar: Pick<
    ExternalCalendar,
    "id" | "user_id" | "sync_direction" | "provider"
  >,
  adapter: Pick<
    SyncAdapter,
    "pushEvent" | "updateRemoteEvent" | "deleteRemoteEvent"
  >,
): Promise<Pick<SyncResult, "pushed" | "errors">> {
  const supabase = createClient();
  const result = { pushed: 0, errors: [] as string[] };

  const { data: pending, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("remote_calendar_id", calendar.id)
    .not("sync_state", "is", null);

  if (error || !pending) return result;

  for (const event of pending as CalendarEvent[]) {
    try {
      if (event.sync_state === "pending_delete") {
        await adapter.deleteRemoteEvent(event.remote_id!);
        await supabase.from("calendar_events").delete().eq("id", event.id);
        result.pushed++;
        continue;
      }

      let remoteId = event.remote_id;
      let etag: string;

      if (event.sync_state === "pending_create") {
        const pushed = await adapter.pushEvent(event);
        remoteId = pushed.remoteId;
        etag = pushed.etag;
      } else {
        // pending_update
        const updated = await adapter.updateRemoteEvent(
          event.remote_id!,
          event,
        );
        etag = updated.etag;
      }

      // Drain rule: clear sync_state only if updated_at is unchanged
      const { count } = await supabase
        .from("calendar_events")
        .update(
          { remote_id: remoteId, etag, sync_state: null },
          { count: "exact" },
        )
        .eq("id", event.id)
        .eq("updated_at", event.updated_at);

      if (count === 0) {
        // Concurrent edit advanced updated_at — keep pending_update so it re-pushes
        await supabase
          .from("calendar_events")
          .update({ remote_id: remoteId, etag, sync_state: "pending_update" })
          .eq("id", event.id);
      }

      result.pushed++;
    } catch (e: unknown) {
      result.errors.push(
        `Failed to push ${event.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}

/**
 * Apply computed pull mutations to the local DB.
 * Writes remote_id and etag as top-level columns, never in metadata.
 */
export async function applyPullMutations(
  mutations: PullMutations,
  calendar: Pick<ExternalCalendar, "id" | "user_id">,
): Promise<Pick<SyncResult, "created" | "updated" | "archived" | "errors">> {
  const supabase = createClient();
  const result = {
    created: 0,
    updated: 0,
    archived: 0,
    errors: [] as string[],
  };

  // Inserts — dedup against remote_ids this user already owns. A live match in
  // another calendar is a genuine duplicate (skip); an archived match is an
  // orphan left by a disconnect, so revive it into this calendar rather than
  // dropping it (otherwise reconnect pulls nothing and events stay hidden).
  if (mutations.toCreate.length > 0) {
    const remoteIds = mutations.toCreate
      .map((item) => item.remote_id)
      .filter((id): id is string => !!id);

    let existingByRemoteId = new Map<
      string,
      { id: string; is_archived: boolean }
    >();
    if (remoteIds.length > 0) {
      const { data: existing } = await supabase
        .from("calendar_events")
        .select("id, remote_id, is_archived")
        .eq("user_id", calendar.user_id)
        .in("remote_id", remoteIds);
      existingByRemoteId = new Map(
        (existing ?? []).map(
          (e: { id: string; remote_id: string; is_archived: boolean }) => [
            e.remote_id,
            { id: e.id, is_archived: e.is_archived },
          ],
        ),
      );
    }

    const rows: Array<Record<string, unknown>> = [];
    const revivals: Array<{
      id: string;
      item: (typeof mutations.toCreate)[number];
    }> = [];
    for (const item of mutations.toCreate) {
      const match = item.remote_id
        ? existingByRemoteId.get(item.remote_id)
        : undefined;
      if (!match) {
        rows.push({
          ...item,
          user_id: calendar.user_id,
          remote_calendar_id: calendar.id,
        });
      } else if (match.is_archived) {
        revivals.push({ id: match.id, item });
      }
      // else: live in another calendar — genuine duplicate, skip
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("calendar_events").insert(rows);
      if (error) {
        result.errors.push(`Failed to batch-create events: ${error.message}`);
      } else {
        result.created += rows.length;
      }
    }

    await Promise.all(
      revivals.map(async ({ id, item }) => {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            ...item,
            remote_calendar_id: calendar.id,
            is_archived: false,
          })
          .eq("id", id);
        if (error)
          result.errors.push(`Failed to revive ${id}: ${error.message}`);
        else result.created++;
      }),
    );
  }

  // Updates are per-row (different payloads) — run in parallel
  await Promise.all(
    mutations.toUpdate.map(async (item) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          ...item.data,
          etag: item.etag,
          ...(item.clearSyncState ? { sync_state: null } : {}),
        })
        .eq("id", item.id);
      if (error)
        result.errors.push(`Failed to update ${item.id}: ${error.message}`);
      else result.updated++;
    }),
  );

  // Batch archive
  if (mutations.toArchive.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .update({ is_archived: true })
      .in("id", mutations.toArchive);
    if (error)
      result.errors.push(`Failed to batch-archive events: ${error.message}`);
    else result.archived += mutations.toArchive.length;
  }

  // Batch hard-delete
  if (mutations.toHardDelete.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .in("id", mutations.toHardDelete);
    if (error)
      result.errors.push(`Failed to batch-delete events: ${error.message}`);
  }

  // Adopt — parallel (different remote_id/etag per row)
  await Promise.all(
    mutations.toAdopt.map(async (item) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          remote_id: item.remote_id,
          etag: item.etag,
          sync_state: null,
        })
        .eq("id", item.id);
      if (error)
        result.errors.push(`Failed to adopt ${item.id}: ${error.message}`);
    }),
  );

  return result;
}

async function updateCalendarStatus(
  id: string,
  updates: Partial<UpdateExternalCalendarInput>,
) {
  const supabase = createClient();
  await supabase.from("external_calendars").update(updates).eq("id", id);
}
