"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

export function useHasFocusLog() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["has-focus-log", isGuestMode],
    staleTime: 60000,
    queryFn: async (): Promise<boolean> => {
      if (isGuestMode) return mockStore.getFocusLogs().length > 0;

      const { data, error } = await createClient()
        .from("focus_logs")
        .select("id")
        .limit(1);
      if (error) throw error;
      return data.length > 0;
    },
  });
}
