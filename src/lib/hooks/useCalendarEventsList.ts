"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { CalendarEvent } from "@/lib/types/calendar-event";

export interface CalendarEventListItem {
  id: string;
  title: string | null;
  date: string; // ISO start_time
}

interface UseCalendarEventsListOptions {
  enabled?: boolean;
}

// Shared query dedupes calendar_events fetching across calendar and search.
export function useDedicatedCalendarEventsQuery(enabled = true) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["calendar-events", isGuestMode],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (isGuestMode) return mockStore.getEvents();

      const supabase = createClient();
      return fetchAllRows<CalendarEvent>((from, to) =>
        supabase
          .from("calendar_events")
          .select("*")
          .eq("is_archived", false)
          .order("start_time", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
    },
    enabled,
  });
}

// Dedicated events only (no tasks with due dates) so search groups stay disjoint.
export function useCalendarEventsList(
  options: UseCalendarEventsListOptions = {},
): CalendarEventListItem[] {
  const { enabled = true } = options;
  const { data } = useDedicatedCalendarEventsQuery(enabled);

  return useMemo(
    () =>
      (data ?? [])
        .filter((e) => !e.is_archived)
        .map((e) => ({
          id: e.id,
          title: e.title,
          date: e.start_time,
        })),
    [data],
  );
}
