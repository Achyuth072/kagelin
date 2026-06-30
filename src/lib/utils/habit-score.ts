import { format, eachDayOfInterval, startOfDay, parseISO } from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";

type FrequencyPeriod = "day" | "week" | "month";

export function periodDays(period: FrequencyPeriod | null): number {
  switch (period) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      // uhabits approximates a month as 30 days; kept for parity.
      return 30;
    default:
      return 1;
  }
}

export function dayValue(
  entryValue: number,
  habit: Pick<Habit, "habit_type" | "target_type" | "target_value">,
): number {
  if (habit.habit_type === "measurable" && habit.target_value != null) {
    if (habit.target_type === "at_least") {
      if (habit.target_value <= 0) {
        // Degenerate target: fall back to boolean done-ness (avoids ÷0 → NaN
        // poisoning the whole score series, mirroring the at_most guard below).
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
  // Boolean: 0 or 1
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

  // Entries are not guaranteed to be sorted (Supabase returns rows without an
  // ORDER BY, and the guest-mode store preserves insertion order), so derive
  // the series start from the earliest entry rather than entries[0].
  const earliest = entries.reduce(
    (min, e) => (e.date < min ? e.date : min),
    entries[0].date,
  );
  const startDate = from ? startOfDay(from) : startOfDay(parseISO(earliest));
  const endDate = startOfDay(to);

  if (startDate > endDate) return [];

  const freqCount = habit.frequency_count ?? 1;
  const freq = freqCount / periodDays(habit.frequency_period ?? null);
  // Ported verbatim from uhabits Score.compute (0.5^(sqrt(freq)/13)); do not retune.
  const multiplier = Math.pow(0.5, Math.sqrt(freq) / 13.0);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const scores: { date: string; value: number }[] = [];
  let prevScore = 0;

  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    const raw = entryMap.get(key) ?? 0;
    const val = dayValue(raw, habit);
    const score = prevScore * multiplier + val * (1 - multiplier);
    scores.push({ date: key, value: score });
    prevScore = score;
  }

  return scores;
}

export function currentScore(habit: Habit, entries: HabitEntry[]): number {
  const scores = computeScores(habit, entries);
  return scores.length > 0 ? scores[scores.length - 1].value : 0;
}
