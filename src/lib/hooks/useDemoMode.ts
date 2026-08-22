"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

// Demo mode is a Guest-only concept — see CONTEXT.md → Guest showcase content.
export function useDemoMode() {
  const { isGuestMode } = useAuth();

  const { data } = useQuery({
    queryKey: ["demo-mode", { isGuestMode }],
    staleTime: 60000,
    queryFn: async () => (isGuestMode ? mockStore.isInDemoMode() : false),
  });

  return data ?? false;
}
