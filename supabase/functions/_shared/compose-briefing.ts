// No Deno/Node APIs — tests/unit imports this directly.

export interface BriefingCounts {
  tasksToday: number;
  overdue: number;
  dueToday: number;
  eventsToday: number;
  habitsPending: number;
}

export interface BriefingPayload {
  title: string;
  body: string;
  data: { url: string };
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function composeBriefing(
  counts: BriefingCounts,
): BriefingPayload | null {
  const parts = [
    counts.tasksToday > 0 && plural(counts.tasksToday, "task", "tasks"),
    counts.overdue > 0 && `${counts.overdue} overdue`,
    counts.dueToday > 0 && `${counts.dueToday} due today`,
    counts.eventsToday > 0 && plural(counts.eventsToday, "event", "events"),
    counts.habitsPending > 0 &&
      `${plural(counts.habitsPending, "habit", "habits")} pending`,
  ].filter((part): part is string => part !== false);

  if (parts.length === 0) return null;

  return {
    title: "Morning Briefing",
    body: `You have ${parts.join(", ")}.`,
    data: { url: "/" },
  };
}
