"use client";

import { useQueryClient } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { notify } from "@/lib/notify";

// Shared so Clear Data, Start fresh and Reset Demo can't drift on which
// caches they clear.
const GUEST_QUERY_KEYS = [
  ["tasks"],
  ["projects"],
  ["habits"],
  ["stats-dashboard"],
  ["calendar-events"],
  ["calendar-tasks"],
  ["demo-mode"],
];

export function useClearGuestData() {
  const queryClient = useQueryClient();

  return () => {
    mockStore.clearData();
    for (const queryKey of GUEST_QUERY_KEYS) {
      queryClient.removeQueries({ queryKey });
    }
    notify.success("All data cleared");
  };
}

// Settings' "Reset Demo" — repopulates seed data, so Demo mode goes back on.
export function useResetDemoData() {
  const queryClient = useQueryClient();

  return () => {
    mockStore.reset();
    for (const queryKey of GUEST_QUERY_KEYS) {
      queryClient.removeQueries({ queryKey });
    }
    notify.success("Demo data reset successfully");
  };
}
