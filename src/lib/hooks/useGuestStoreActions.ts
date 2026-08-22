"use client";

import { useQueryClient } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { notify } from "@/lib/notify";

// Shared so Clear Data, Start fresh and Reset Demo can't drift on which
// caches they clear.
const GUEST_QUERY_KEYS = [
  "tasks",
  "projects",
  "habits",
  "stats-dashboard",
  "calendar-events",
  "calendar-tasks",
  "demo-mode",
];

function useGuestStoreAction(action: () => void, message: string) {
  const queryClient = useQueryClient();

  return () => {
    action();
    queryClient.removeQueries({
      predicate: (query) =>
        GUEST_QUERY_KEYS.includes(query.queryKey[0] as string),
    });
    notify.success(message);
  };
}

export function useClearGuestData() {
  return useGuestStoreAction(() => mockStore.clearData(), "All data cleared");
}

// Settings' "Reset Demo" — repopulates seed data, so Demo mode goes back on.
export function useResetDemoData() {
  return useGuestStoreAction(
    () => mockStore.reset(),
    "Demo data reset successfully",
  );
}
