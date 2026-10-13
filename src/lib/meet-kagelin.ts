import { formatModChord } from "@/lib/utils/platform";
import { REPO_URL } from "@/lib/links";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

// One list for the guest demo and the opt-in project for accounts.
export const MEET_KAGELIN_PROJECT = {
  name: "Meet Kagelin",
  color: "#B56C5A",
} as const;

export interface TutorialStep {
  content: string;
  description: string;
  // do_date keeps a step off the Calendar; due_date puts it on. null: undated.
  schedule: { field: "do_date" | "due_date"; hour: number } | null;
  recurrence?: RecurrenceRule;
  subtasks?: string[];
}

// 7:00 is before every timed step; equal times keep this order.
const PLANNED = { field: "do_date", hour: 7 } as const;

// Titles stay short enough not to truncate on a phone.
export function meetKagelinSteps(): TutorialStep[] {
  return [
    {
      content: "Add a task (N or +)",
      description: "Press N on a keyboard, or tap + on a phone.",
      schedule: PLANNED,
    },
    {
      content: `Open Search (${formatModChord("K")})`,
      description: "On a phone, tap ⋮ → Search. It runs any command, too.",
      schedule: PLANNED,
    },
    {
      content: "See shortcuts (?)",
      description: "Press ? on a keyboard.",
      schedule: PLANNED,
    },
    {
      content: "Break into steps",
      description: "Steps are subtasks. Open this task to tick them off.",
      schedule: PLANNED,
      subtasks: ["Open this task", "Tick off this step"],
    },
    {
      content: "Focus on this task",
      description: "Tap the play button on this task's row.",
      schedule: PLANNED,
    },
    {
      content: "Tick off a habit",
      description: "Open Habits and tap today. No habit yet? Press H.",
      schedule: PLANNED,
    },
    {
      content: "Plan your week",
      description:
        "It repeats every week. Tick it off and next week's appears.",
      schedule: { field: "due_date", hour: 9 },
      recurrence: { freq: "WEEKLY", interval: 1 },
    },
    {
      content: "Call the dentist",
      description: "It has a time, so it shows on the Calendar too.",
      schedule: { field: "due_date", hour: 15 },
    },
    {
      content: "See all features",
      description: `The full list: [docs/features.md](${REPO_URL}/blob/main/docs/features.md).`,
      schedule: null,
    },
  ];
}

export function stepDates(
  step: TutorialStep,
  day: Date,
): { due_date: string | null; do_date: string | null } {
  if (!step.schedule) return { due_date: null, do_date: null };
  const date = new Date(day);
  date.setHours(step.schedule.hour, 0, 0, 0);
  const iso = date.toISOString();
  return step.schedule.field === "due_date"
    ? { due_date: iso, do_date: null }
    : { due_date: null, do_date: iso };
}
