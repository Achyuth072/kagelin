import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

/**
 * useTodayFocusSessions — count of focus sessions completed *today*, sourced
 * from the server `focus_logs` (the authoritative, cross-device record) so every
 * device shows the same number. The local focusHistoryStore is per-device and
 * only reflects sessions that device witnessed completing, so it diverges across
 * devices; this reads the shared source instead. refetchOnWindowFocus keeps it
 * fresh when you switch to another device.
 */
export function useTodayFocusSessions() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["today-focus-count", isGuestMode],
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startIso = startOfToday.toISOString();

      if (isGuestMode) {
        return mockStore
          .getFocusLogs()
          .filter((log) => log.start_time >= startIso).length;
      }

      const supabase = createClient();
      const { count, error } = await supabase
        .from("focus_logs")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startIso);

      if (error) throw error;
      return count ?? 0;
    },
  });
}
