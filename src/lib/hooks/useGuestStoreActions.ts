"use client";

import { useQueryClient } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { notify } from "@/lib/notify";

const GUEST_QUERY_KEYS = [
  "tasks",
  "projects",
  "habits",
  "stats-dashboard",
  "calendar-events",
  "calendar-tasks",
  "demo-mode",
  "has-focus-log",
];

function useGuestStoreAction(action: () => void, message: string) {
  const queryClient = useQueryClient();

  return () => {
    action();
    // resetQueries notifies mounted observers; removeQueries leaves stale UI.
    queryClient.resetQueries({
      predicate: (query) =>
        GUEST_QUERY_KEYS.includes(query.queryKey[0] as string),
    });
    notify.success(message);
  };
}

export function useClearGuestData() {
  return useGuestStoreAction(() => mockStore.clearData(), "All data cleared");
}

export function useResetDemoData() {
  return useGuestStoreAction(
    () => mockStore.reset(),
    "Demo data reset successfully",
  );
}
