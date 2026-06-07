import type { SyncState } from "./crud-state";

export interface LWWInput {
  syncState: SyncState;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}

export type LWWWinner = "local" | "remote";

export function resolveLWW({
  syncState,
  localUpdatedAt,
  remoteUpdatedAt,
}: LWWInput): LWWWinner {
  // A clean synced row with no pending local change always yields to remote.
  if (syncState === null) return "remote";
  // A pending local delete must survive a concurrent remote edit — overwriting it
  // would silently resurrect an event the user deleted.
  if (syncState === "pending_delete") return "local";
  // pending_update / pending_create: last write wins by timestamp.
  return new Date(localUpdatedAt) > new Date(remoteUpdatedAt)
    ? "local"
    : "remote";
}
