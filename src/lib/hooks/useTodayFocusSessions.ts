import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { useCurrentTime } from "@/lib/hooks/useCurrentTime";

const supabase = createClient();

// Parameterized with current date so midnight rollover busts stale cached count
export function useTodayFocusSessions() {
  const { isGuestMode } = useAuth();
  const currentTime = useCurrentTime(60_000);
  const todayDate = format(currentTime, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["today-focus-count", isGuestMode, todayDate],
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const startIso = startOfDay(currentTime).toISOString();

      if (isGuestMode) {
        return mockStore
          .getFocusLogs()
          .filter((log) => log.start_time >= startIso).length;
      }

      const { count, error } = await supabase
        .from("focus_logs")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startIso);

      if (error) throw error;
      return count ?? 0;
    },
  });
}
