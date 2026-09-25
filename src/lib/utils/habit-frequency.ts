import type { Habit } from "@/lib/types/habit";

type FrequencyPeriod = "day" | "week" | "month";

// uhabits approximates a month as 30 days; kept for parity.
const PERIOD_DAYS: Record<FrequencyPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
};

// Falls back to period for legacy caches and storage lacking frequency_days (ADR 0019).
export function frequencyWindowDays(
  habit: Pick<Habit, "frequency_days" | "frequency_period">,
): number {
  if (habit.frequency_days != null) return habit.frequency_days;
  return PERIOD_DAYS[habit.frequency_period ?? "day"];
}

export function periodForFrequencyDays(days: number): FrequencyPeriod | null {
  switch (days) {
    case 1:
      return "day";
    case 7:
      return "week";
    case 30:
      return "month";
    default:
      return null;
  }
}
