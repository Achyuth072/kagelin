"use client";

import { useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QueryClientContext } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Timer, X } from "lucide-react";
import { isBefore, isSameDay, parseISO } from "date-fns";
import { useTasks } from "@/lib/hooks/useTasks";
import { categorizeTaskSchedule } from "@/lib/utils/task-metrics";
import { useDedicatedCalendarEventsQuery } from "@/lib/hooks/useCalendarEventsList";
import { useTodayFocusSessions } from "@/lib/hooks/useTodayFocusSessions";
import { useCurrentTime } from "@/lib/hooks/useCurrentTime";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { Task } from "@/lib/types/task";
import type { CalendarEvent } from "@/lib/types/calendar-event";

const PILL_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-lg bg-card border border-border hover:bg-accent hover:border-border-strong text-xs font-medium text-foreground transition-colors duration-150 tabular-nums";

interface DailyBriefStripProps {
  projectId?: string;
  filter?: string;
}

export function DailyBriefStrip({
  projectId = "all",
  filter,
}: DailyBriefStripProps) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) {
    return (
      <DailyBriefStripView
        projectId={projectId}
        filter={filter}
        tasks={[]}
        events={[]}
        focusCount={0}
      />
    );
  }

  return <DailyBriefStripConnected projectId={projectId} filter={filter} />;
}

function DailyBriefStripConnected({
  projectId = "all",
  filter,
}: DailyBriefStripProps) {
  const { data: tasks = [] } = useTasks({ projectId: "all" });
  const { data: events = [] } = useDedicatedCalendarEventsQuery();
  const { data: focusCount = 0 } = useTodayFocusSessions();

  return (
    <DailyBriefStripView
      projectId={projectId}
      filter={filter}
      tasks={tasks}
      events={events}
      focusCount={focusCount}
    />
  );
}

interface DailyBriefStripViewProps extends DailyBriefStripProps {
  tasks: Task[];
  events: CalendarEvent[];
  focusCount: number;
}

function DailyBriefStripView({
  projectId = "all",
  filter,
  tasks,
  events,
  focusCount,
}: DailyBriefStripViewProps) {
  const router = useRouter();
  const { trigger } = useHaptic();
  const setShowDailyBrief = useUiStore((state) => state.setShowDailyBrief);
  const now = useCurrentTime(60_000);
  const { formatTime } = useTimeFormat();

  let todayCount = 0;
  let overdueCount = 0;
  for (const task of tasks) {
    if (task.is_completed) continue;
    const category = categorizeTaskSchedule(task, now);
    if (category === "planned_today" || category === "due_today") {
      todayCount += 1;
    } else if (category === "overdue") {
      overdueCount += 1;
    }
  }

  const nextEvent = events
    .filter((e) => !e.is_archived && e.start_time)
    .map((e) => ({ event: e, start: parseISO(e.start_time) }))
    .filter(
      ({ start }) =>
        !isNaN(start.getTime()) &&
        isSameDay(start, now) &&
        !isBefore(start, now),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  const handleTasksClick = () => {
    trigger("toggle");
    if (projectId !== "all" || filter) {
      router.push("/");
      return;
    }
    const container = document.querySelector<HTMLElement>(
      '[data-task-list-scroll-container="true"]',
    );
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      container.focus();
    }
  };

  return (
    <div
      data-testid="daily-brief-strip"
      className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 md:px-6 pb-2 h-10 shrink-0"
    >
      <button type="button" onClick={handleTasksClick} className={PILL_CLASS}>
        <CheckCircle2
          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          strokeWidth={2.25}
        />
        {todayCount === 0 && overdueCount === 0 ? (
          <span>All clear today</span>
        ) : (
          <span>
            {todayCount} today
            {overdueCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {overdueCount} overdue
              </span>
            )}
          </span>
        )}
      </button>

      <Link href="/calendar" prefetch={true} className={PILL_CLASS}>
        <Calendar
          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          strokeWidth={2.25}
        />
        {nextEvent ? (
          <span className="inline-flex items-center gap-1">
            <span>Next:</span>
            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {nextEvent.event.title || "Untitled"}
            </span>
            <span className="text-muted-foreground">
              · {formatTime(nextEvent.start)}
            </span>
          </span>
        ) : (
          <span>No more events</span>
        )}
      </Link>

      <Link href="/focus" prefetch={true} className={PILL_CLASS}>
        <Timer
          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          strokeWidth={2.25}
        />
        <span>
          {focusCount === 0
            ? "Start focus"
            : `${focusCount} focus ${focusCount === 1 ? "session" : "sessions"} today`}
        </span>
      </Link>

      <button
        type="button"
        onClick={() => {
          trigger("toggle");
          setShowDailyBrief(false);
        }}
        aria-label="Hide Daily Brief"
        title="Hide brief (re-enable in Preferences)"
        className="ml-auto shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
