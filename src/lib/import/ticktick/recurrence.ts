import ICAL from "ical.js";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

const DAY_CODE_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function parseTickTickRecurrence(
  repeatStr?: string | null,
): RecurrenceRule | null {
  if (!repeatStr || !repeatStr.trim()) {
    return null;
  }

  const trimmed = repeatStr.trim();
  // ICAL.Recur.fromString expects property value without the "RRULE:" prefix
  const rruleClean = trimmed.replace(/^RRULE:\s*/i, "");

  try {
    const recur = ICAL.Recur.fromString(rruleClean);
    if (!recur || !recur.freq) {
      return null;
    }

    const interval =
      typeof recur.interval === "number" && recur.interval > 0
        ? recur.interval
        : 1;

    switch (recur.freq) {
      case "DAILY":
        return {
          freq: "DAILY",
          interval,
        };

      case "WEEKLY": {
        const rawByDay = recur.parts?.BYDAY;
        const byDayArray: string[] = Array.isArray(rawByDay)
          ? (rawByDay as string[])
          : typeof rawByDay === "string"
            ? [rawByDay]
            : [];

        const days: number[] = [];
        for (const entry of byDayArray) {
          const codeMatch = /([A-Z]{2})$/.exec(entry);
          if (codeMatch && codeMatch[1] in DAY_CODE_MAP) {
            days.push(DAY_CODE_MAP[codeMatch[1]]);
          }
        }

        return {
          freq: "WEEKLY",
          interval,
          ...(days.length > 0
            ? { days: Array.from(new Set(days)).sort((a, b) => a - b) }
            : {}),
        };
      }

      case "MONTHLY":
        return {
          freq: "MONTHLY",
          interval,
        };

      case "YEARLY":
        return {
          freq: "YEARLY",
          interval,
        };

      default:
        return null;
    }
  } catch {
    return null;
  }
}
