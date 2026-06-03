import type { CalendarEvent } from "@/lib/types/calendar-event";

export type SyncState = CalendarEvent["sync_state"];
export type CrudAction = "edit" | "delete";

export interface CrudTransition {
  newState: SyncState;
  hardDelete: boolean;
}

export function applyCrudTransition(
  current: SyncState,
  action: CrudAction,
): CrudTransition {
  if (action === "edit") {
    // Never downgrade pending_create — no remote exists yet
    if (current === "pending_create") return { newState: "pending_create", hardDelete: false };
    return { newState: "pending_update", hardDelete: false };
  }

  // action === "delete"
  if (current === "pending_create") {
    // Nothing remote exists — skip the remote call, hard-delete now
    return { newState: null, hardDelete: true };
  }
  return { newState: "pending_delete", hardDelete: false };
}
