import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { useCalendarStore } from "@/lib/calendar/store";
import { useEffect, useMemo } from "react";
import type { CalendarEventUI } from "@/lib/calendar/types";
import { toCalendarEventUI } from "@/lib/types/calendar-event";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { useDedicatedCalendarEventsQuery } from "@/lib/hooks/useCalendarEventsList";

export function useCalendarEvents() {
  const setEvents = useCalendarStore((state) => state.setEvents);
  const { isGuestMode } = useAuth();

  const { data: dedicatedEvents, isLoading: eventsLoading } =
    useDedicatedCalendarEventsQuery();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["calendar-tasks", isGuestMode],
    queryFn: async () => {
      if (isGuestMode) {
        const allTasks = mockStore.getTasks();
        const allProjects = mockStore.getProjects();
        const projectMap = new Map(allProjects.map((p) => [p.id, p]));

        return allTasks
          .filter((t) => t.due_date)
          .map((t) => ({
            id: t.id,
            content: t.content,
            due_date: t.due_date!,
            project_id: t.project_id,
            projects: t.project_id
              ? {
                  color:
                    projectMap.get(t.project_id)?.color ||
                    "hsl(var(--primary))",
                }
              : null,
          }));
      }

      const supabase = createClient();
      return fetchAllRows<{
        id: string;
        content: string;
        due_date: string;
        project_id: string | null;
        projects: { color: string } | { color: string }[] | null;
      }>((from, to) =>
        supabase
          .from("tasks")
          .select(
            `
          id,
          content,
          due_date,
          project_id,
          projects (
            color
          )
        `,
          )
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
    },
  });

  const calendarEvents = useMemo(() => {
    const dedicated: CalendarEventUI[] = (dedicatedEvents ?? []).map(
      toCalendarEventUI,
    );

    const taskEvents: CalendarEventUI[] = (tasks ?? []).map((task) => {
      const startDate = new Date(task.due_date);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const projectColor = Array.isArray(task.projects)
        ? task.projects[0]?.color
        : task.projects?.color;

      return {
        id: task.id,
        title: task.content,
        start: startDate,
        end: endDate,
        allDay: false,
        color: projectColor || "hsl(var(--primary))",
        category: "task",
      };
    });

    return [...dedicated, ...taskEvents];
  }, [dedicatedEvents, tasks]);

  useEffect(() => {
    setEvents(calendarEvents);
  }, [calendarEvents, setEvents]);

  return { isLoading: eventsLoading || tasksLoading };
}
