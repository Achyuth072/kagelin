import * as chrono from "chrono-node";
import { addDays } from "date-fns";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

const DAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export interface ParseDateAndRecurrenceOptions {
  dateStr?: string;
  deadlineStr?: string;
  refDate?: Date;
}

export interface ParsedDateResult {
  dueDate: string | null;
  doDate: string | null;
  recurrence: RecurrenceRule | null;
}

/**
 * Checks if a string contains a natural language recurrence rule
 */
export function isRecurrencePattern(str: string): boolean {
  const lower = str.trim().toLowerCase();
  return (
    lower.startsWith("every") ||
    lower.startsWith("daily") ||
    lower.startsWith("weekly") ||
    lower.startsWith("monthly") ||
    lower.startsWith("yearly")
  );
}

const SINGLETON_FREQS: Record<
  string,
  "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

const UNIT_MAP = {
  day: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
  year: "YEARLY",
} as const;

/**
 * Parses natural language recurrence expressions into Kagelin's RecurrenceRule
 */
export function parseRecurrenceRule(dateStr: string): RecurrenceRule | null {
  const clean = dateStr.trim().toLowerCase();
  const isFlexible = clean.includes("every!");
  const mode: "strict" | "flexible" = isFlexible ? "flexible" : "strict";

  // Remove time components like "@ 13:00" or "at 15:00"
  const recurrencePart = clean
    .replace(/(@|at)\s+\d{1,2}(:\d{2})?.*/, "")
    .trim();

  if (recurrencePart in SINGLETON_FREQS) {
    return { freq: SINGLETON_FREQS[recurrencePart], interval: 1, mode };
  }

  const standardIntervalMatch = recurrencePart.match(
    /^every!?\s*(?:(\d+)\s+)?(day|week|month|year)s?$/,
  );
  if (standardIntervalMatch) {
    return {
      freq: UNIT_MAP[standardIntervalMatch[2] as keyof typeof UNIT_MAP],
      interval: standardIntervalMatch[1]
        ? parseInt(standardIntervalMatch[1], 10)
        : 1,
      mode,
    };
  }

  // Weekday / Workday
  if (/^every!?\s+(weekday|workday)s?$/.test(recurrencePart)) {
    return {
      freq: "WEEKLY",
      interval: 1,
      days: [1, 2, 3, 4, 5],
      mode,
    };
  }

  // Weekend
  if (/^every!?\s+weekends?$/.test(recurrencePart)) {
    return {
      freq: "WEEKLY",
      interval: 1,
      days: [0, 6],
      mode,
    };
  }

  // Specific weekdays: e.g. "every mon, wed, fri" or "every monday and friday" or "every friday"
  const weekdayListMatch = recurrencePart.match(/^every!?\s+([a-z,\s]+)$/);
  if (weekdayListMatch) {
    const rawTokens = weekdayListMatch[1]
      .replace(/and/g, " ")
      .split(/[\s,]+/)
      .filter(Boolean);

    const matchedDays = Array.from(
      new Set(
        rawTokens
          .map((t) => DAY_MAP[t])
          .filter((d): d is number => d !== undefined),
      ),
    ).sort((a, b) => a - b);

    if (matchedDays.length > 0) {
      return {
        freq: "WEEKLY",
        interval: 1,
        days: matchedDays,
        mode,
      };
    }
  }

  return null;
}

/**
 * Calculates the next anchor date for a recurring rule from a reference date (today).
 */
export function calculateInitialRecurrenceDate(
  rule: RecurrenceRule,
  refDate: Date = new Date(),
): Date {
  if (rule.freq === "WEEKLY" && rule.days && rule.days.length > 0) {
    const currentDayOfWeek = refDate.getDay();
    const upcoming = rule.days.find((d) => d >= currentDayOfWeek);
    const targetDay = upcoming ?? 7 + rule.days[0];
    return addDays(refDate, targetDay - currentDayOfWeek);
  }

  return refDate;
}

/**
 * Normalizes a non-recurring date string (ISO or natural language) into an ISO string.
 */
function parseDateStringToIso(dateStr: string, refDate: Date): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Check if it's already a valid ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
  }

  // Try standard Date parsing for ISO-like strings
  const directDate = new Date(trimmed);
  if (!isNaN(directDate.getTime()) && trimmed.includes("-")) {
    return directDate.toISOString();
  }

  // Fallback to chrono-node
  const parsedChrono = chrono.parseDate(trimmed, refDate);
  if (parsedChrono) {
    return parsedChrono.toISOString();
  }

  return null;
}

export function parseTodoistDateAndRecurrence(
  options: ParseDateAndRecurrenceOptions,
): ParsedDateResult {
  const { dateStr, deadlineStr, refDate = new Date() } = options;

  let dueDate: string | null = null;
  let doDate: string | null = null;
  let recurrence: RecurrenceRule | null = null;

  const hasDate = Boolean(dateStr && dateStr.trim());
  const hasDeadline = Boolean(deadlineStr && deadlineStr.trim());

  if (hasDate && isRecurrencePattern(dateStr!)) {
    recurrence = parseRecurrenceRule(dateStr!);
    if (recurrence) {
      const initialDate = calculateInitialRecurrenceDate(recurrence, refDate);
      dueDate = initialDate.toISOString();
    }
  }

  if (hasDeadline) {
    const parsedDeadline = parseDateStringToIso(deadlineStr!, refDate);
    if (parsedDeadline) {
      dueDate = parsedDeadline;
      if (hasDate && !recurrence) {
        doDate = parseDateStringToIso(dateStr!, refDate);
      }
    }
  } else if (hasDate && !recurrence) {
    dueDate = parseDateStringToIso(dateStr!, refDate);
  }

  return {
    dueDate,
    doDate,
    recurrence,
  };
}
