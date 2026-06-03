import type { SyncState } from "./crud-state";

export interface LWWInput {
  syncState: SyncState;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}

export type LWWWinner = "local" | "remote";

export function resolveLWW({ syncState, localUpdatedAt, remoteUpdatedAt }: LWWInput): LWWWinner {
  if (syncState !== "pending_update") return "remote";
  return new Date(localUpdatedAt) > new Date(remoteUpdatedAt) ? "local" : "remote";
}
