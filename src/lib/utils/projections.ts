import {
  startOfMonth,
  endOfMonth,
  differenceInCalendarDays,
  format,
} from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { getCurrentStreak } from "@/lib/utils/habit-streak";

type RiskCandidateHabit = Pick<
  Habit,
  | "id"
  | "name"
  | "color"
  | "archived_at"
  | "habit_type"
  | "frequency_count"
  | "frequency_period"
  | "target_type"
  | "target_value"
> & { entries: HabitEntry[] };

const PACE_WINDOW_DAYS = 7;

export interface PaceProjection {
  soFar: number;
  projected: number;
  pacePerDay: number;
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
}

/**
 * Pace-based projection of a daily metric to the end of the current
 * calendar month: what's logged so far this month, plus the trailing
 * PACE_WINDOW_DAYS average carried over the remaining days. Deliberately
 * calendar-month framed (not tied to the stats page's period selector) to
 * match "on track for N this month."
 */
function projectMetricThisMonth<T extends { date: string }>(
  dailyTrend: T[],
  getValue: (day: T) => number,
  now: Date,
): PaceProjection {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthStartKey = format(monthStart, "yyyy-MM-dd");
  const todayKey = format(now, "yyyy-MM-dd");

  const soFar = dailyTrend
    .filter((d) => d.date >= monthStartKey && d.date <= todayKey)
    .reduce((sum, d) => sum + getValue(d), 0);

  const recentDays = dailyTrend
    .filter((d) => d.date <= todayKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, PACE_WINDOW_DAYS);
  const pacePerDay =
    recentDays.length > 0
      ? recentDays.reduce((sum, d) => sum + getValue(d), 0) / recentDays.length
      : 0;

  const daysElapsed = differenceInCalendarDays(now, monthStart) + 1;
  const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;
  const daysRemaining = daysInMonth - daysElapsed;

  return {
    soFar,
    projected: soFar + pacePerDay * daysRemaining,
    pacePerDay,
    daysElapsed,
    daysRemaining,
    daysInMonth,
  };
}

/** Tasks-completed variant of {@link projectMetricThisMonth}. */
export function projectTasksThisMonth(
  dailyTrend: { date: string; tasksCompleted: number }[],
  now: Date = new Date(),
): PaceProjection {
  return projectMetricThisMonth(dailyTrend, (d) => d.tasksCompleted, now);
}

/** Focus-hours variant of {@link projectMetricThisMonth}. */
export function projectFocusHoursThisMonth(
  dailyTrend: { date: string; hours: number }[],
  now: Date = new Date(),
): PaceProjection {
  return projectMetricThisMonth(dailyTrend, (d) => d.hours, now);
}

export interface StreakAtRisk {
  habitId: string;
  name: string;
  color: string;
  currentStreak: number;
}

function isDailyFrequency(habit: RiskCandidateHabit): boolean {
  const count = habit.frequency_count ?? 1;
  const period = habit.frequency_period ?? "day";
  return count === 1 && period === "day";
}

/**
 * Daily-frequency boolean habits with an active streak that haven't logged
 * today — missing today breaks the streak tonight.
 *
 * Scoped to daily habits only: the frequency-aware streak algorithm
 * (habit-streak.ts) interpolates a non-daily habit's covered days from its
 * last logged rep, so its coverage window doesn't shrink day-by-day as
 * "today" advances — it either still has slack or has already dropped to
 * zero, with no reliable "tight but still alive" state to flag. Non-daily
 * habits already surface a frequency-progress ring elsewhere (habit cards /
 * Insights), so this signal focuses on the case it can call precisely.
 * Measurable and archived habits are excluded, matching the Boolean-only
 * streak precedent.
 */
export function getStreaksAtRisk(
  habits: RiskCandidateHabit[],
  now: Date = new Date(),
): StreakAtRisk[] {
  const todayKey = format(now, "yyyy-MM-dd");

  const risks: StreakAtRisk[] = [];
  for (const habit of habits) {
    if (habit.archived_at || habit.habit_type === "measurable") continue;
    if (!isDailyFrequency(habit)) continue;

    const streak = getCurrentStreak(habit, habit.entries, now);
    if (streak <= 0) continue;

    const doneToday = habit.entries.some(
      (e) => e.date === todayKey && e.value >= 1,
    );
    if (doneToday) continue;

    risks.push({
      habitId: habit.id,
      name: habit.name,
      color: habit.color,
      currentStreak: streak,
    });
  }
  return risks;
}
