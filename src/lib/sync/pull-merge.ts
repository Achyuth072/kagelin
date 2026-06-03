import type { CalendarEvent, CreateCalendarEventInput } from "@/lib/types/calendar-event";
import { resolveLWW } from "./conflict";

export interface IncomingRemoteEvent {
  remoteId: string;
  etag: string;
  updatedAt: Date;
  kansoId?: string;
  parsed: CreateCalendarEventInput;
}

export interface PullMutations {
  toCreate: Array<CreateCalendarEventInput & { remote_id: string; etag: string }>;
  toUpdate: Array<{ id: string; data: CreateCalendarEventInput; etag: string; clearSyncState: boolean }>;
  toArchive: string[];
  toHardDelete: string[];
  toAdopt: Array<{ id: string; remote_id: string; etag: string }>;
}

export function computePullMutations(
  localEvents: CalendarEvent[],
  remoteEvents: IncomingRemoteEvent[],
  deletedRemoteIds: string[],
): PullMutations {
  const result: PullMutations = {
    toCreate: [],
    toUpdate: [],
    toArchive: [],
    toHardDelete: [],
    toAdopt: [],
  };

  const localByRemoteId = new Map(localEvents.filter((e) => e.remote_id).map((e) => [e.remote_id!, e]));
  const localById = new Map(localEvents.map((e) => [e.id, e]));

  for (const remote of remoteEvents) {
    const local = localByRemoteId.get(remote.remoteId);

    if (!local) {
      if (remote.kansoId) {
        const candidate = localById.get(remote.kansoId);
        if (candidate?.sync_state === "pending_create") {
          result.toAdopt.push({ id: candidate.id, remote_id: remote.remoteId, etag: remote.etag });
          continue;
        }
      }
      result.toCreate.push({ ...remote.parsed, remote_id: remote.remoteId, etag: remote.etag });
      continue;
    }

    if (local.etag === remote.etag) continue;

    const winner = resolveLWW({
      syncState: local.sync_state,
      localUpdatedAt: local.updated_at,
      remoteUpdatedAt: remote.updatedAt.toISOString(),
    });

    if (winner === "remote") {
      result.toUpdate.push({ id: local.id, data: remote.parsed, etag: remote.etag, clearSyncState: true });
    }
  }

  for (const remoteId of deletedRemoteIds) {
    const local = localByRemoteId.get(remoteId);
    if (!local) continue;
    if (local.sync_state === "pending_create") {
      result.toHardDelete.push(local.id);
    } else {
      result.toArchive.push(local.id);
    }
  }

  return result;
}
