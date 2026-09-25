import { format, eachDayOfInterval, startOfDay, parseISO } from "date-fns";
import {
  type Habit,
  type HabitEntry,
  ENTRY_VALUE_SKIPPED,
} from "@/lib/types/habit";
import { frequencyWindowDays } from "@/lib/utils/habit-frequency";

export function isLoggedEntry(entryValue: number): boolean {
  return entryValue !== ENTRY_VALUE_SKIPPED;
}

export function dayValue(
  entryValue: number,
  habit: Pick<Habit, "habit_type" | "target_type" | "target_value">,
): number {
  if (entryValue < 0) return 0;
  if (habit.habit_type === "measurable" && habit.target_value != null) {
    if (habit.target_type === "at_least") {
      if (habit.target_value <= 0) {
        // Fall back to boolean done-ness to avoid division by zero.
        return entryValue >= 1 ? 1 : 0;
      }
      return Math.min(1, entryValue / habit.target_value);
    }
    if (habit.target_type === "at_most") {
      if (habit.target_value <= 0) {
        return entryValue <= 0 ? 1 : 0;
      }
      return Math.max(0, Math.min(1, 2 - entryValue / habit.target_value));
    }
  }
  return entryValue >= 1 ? 1 : 0;
}

export function computeScores(
  habit: Habit,
  entries: HabitEntry[],
  { from, to = new Date() }: { from?: Date; to?: Date } = {},
): { date: string; value: number }[] {
  if (entries.length === 0) return [];

  const entryMap = new Map<string, number>();
  for (const e of entries) {
    entryMap.set(e.date, e.value);
  }

  // Database and guest store entries are not guaranteed to be sorted by date.
  const earliest = entries.reduce(
    (min, e) => (e.date < min ? e.date : min),
    entries[0].date,
  );
  const startDate = from ? startOfDay(from) : startOfDay(parseISO(earliest));
  const endDate = startOfDay(to);

  if (startDate > endDate) return [];

  const freqCount = habit.frequency_count ?? 1;
  const freq = freqCount / frequencyWindowDays(habit);
  // Ported verbatim from uhabits Score.compute (0.5^(sqrt(freq)/13)); do not retune.
  const multiplier = Math.pow(0.5, Math.sqrt(freq) / 13.0);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const scores: { date: string; value: number }[] = [];
  let prevScore = 0;

  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    const raw = entryMap.get(key) ?? 0;
    let score: number;
    if (raw === ENTRY_VALUE_SKIPPED) {
      score = prevScore;
    } else {
      const val = dayValue(raw, habit);
      score = prevScore * multiplier + val * (1 - multiplier);
    }
    scores.push({ date: key, value: score });
    prevScore = score;
  }

  return scores;
}

export function currentScore(
  habit: Habit,
  entries: HabitEntry[],
  options?: { from?: Date; to?: Date },
): number {
  const scores = computeScores(habit, entries, options);
  return scores.length > 0 ? scores[scores.length - 1].value : 0;
}
