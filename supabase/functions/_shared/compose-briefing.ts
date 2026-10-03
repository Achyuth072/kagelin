// No Deno/Node APIs — tests/unit imports this directly.

export interface BriefingCounts {
  tasksToday: number;
  overdue: number;
  dueToday: number;
  eventsToday: number;
  habitsPending: number;
}

export interface EveningCounts {
  tasksFinished: number;
  habitsFinished: number;
  tasksTomorrow: number;
  eventsTomorrow: number;
}

// Composer never sees plaintext (ADR 0016).
export interface NextUp {
  ciphertext: string;
  time?: string | null;
}

export type BriefingInput =
  | { kind: "morning"; counts: BriefingCounts; nextUp?: NextUp | null }
  | { kind: "evening"; counts: EveningCounts; nextUp?: NextUp | null };

export interface BriefingPayload {
  title: string;
  body: string;
  encrypted?: { template: string; ciphertext: string };
  data: { url: string };
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const join = (parts: Array<string | false>) =>
  parts.filter((part): part is string => part !== false).join(", ");

function composeBody(input: BriefingInput): string | null {
  if (input.kind === "morning") {
    const { counts } = input;
    const parts = join([
      counts.tasksToday > 0 && plural(counts.tasksToday, "task", "tasks"),
      counts.overdue > 0 && `${counts.overdue} overdue`,
      counts.dueToday > 0 && `${counts.dueToday} due today`,
      counts.eventsToday > 0 && plural(counts.eventsToday, "event", "events"),
      counts.habitsPending > 0 &&
        `${plural(counts.habitsPending, "habit", "habits")} pending`,
    ]);
    return parts && `You have ${parts}.`;
  }

  const { counts } = input;
  const finished = join([
    counts.tasksFinished > 0 && plural(counts.tasksFinished, "task", "tasks"),
    counts.habitsFinished > 0 &&
      plural(counts.habitsFinished, "habit", "habits"),
  ]);
  const tomorrow = join([
    counts.tasksTomorrow > 0 && plural(counts.tasksTomorrow, "task", "tasks"),
    counts.eventsTomorrow > 0 &&
      plural(counts.eventsTomorrow, "event", "events"),
  ]);
  const sentences = [
    finished && `Finished today: ${finished}.`,
    tomorrow && `Tomorrow: ${tomorrow}.`,
  ].filter(Boolean);
  return sentences.length > 0 ? sentences.join(" ") : null;
}

export function composeBriefing(input: BriefingInput): BriefingPayload | null {
  const body = composeBody(input);
  if (!body) return null;

  const payload: BriefingPayload = {
    title: input.kind === "morning" ? "Morning Briefing" : "Evening Plan",
    body,
    data: { url: "/" },
  };

  const { nextUp } = input;
  if (nextUp?.ciphertext) {
    const time = nextUp.time ? `${nextUp.time} ` : "";
    payload.encrypted = {
      template: `${body} Next: ${time}{}`,
      ciphertext: nextUp.ciphertext,
    };
  }

  return payload;
}
