import * as chrono from "chrono-node";
import { isToday, isTomorrow, format } from "date-fns";

export interface ParsedTaskInput {
  cleanedTitle: string;
  matchedText: string;
  date: Date;
  field: "do_date" | "due_date";
  hasTime: boolean;
}

/**
 * Parses natural language input for task creation to extract a target date
 * and determine whether it represents a Do Date or a Due Date.
 *
 * Rules:
 * - Only parses if input.trim().length >= 3.
 * - If the matched date fragment is immediately preceded by `due` or `by`
 *   (case-insensitive word boundary), field is "due_date" and that keyword
 *   is stripped along with the date fragment.
 * - Otherwise, field defaults to "do_date" (with leading/trailing dangling
 *   prepositions stripped like `nlp-event.ts`).
 * - Safety guard: If stripping leaves cleanedTitle empty, returns null.
 */
export function parseTaskInput(
  input: string,
  refDate: Date = new Date(),
): ParsedTaskInput | null {
  const trimmed = input.trim();
  if (trimmed.length < 3) {
    return null;
  }

  const results = chrono.parse(trimmed, refDate, { forwardDate: true });
  if (results.length === 0) {
    return null;
  }

  const result = results[0];
  const date = result.start.date();
  const hasTime = result.start.isCertain("hour");

  const prefix = trimmed.slice(0, result.index);
  const suffix = trimmed.slice(result.index + result.text.length);

  const dueByMatch = prefix.match(/\b(due|by)\s*:?\s*$/i);
  const field: "do_date" | "due_date" = dueByMatch ? "due_date" : "do_date";

  let cleanedTitle = "";
  if (dueByMatch) {
    const prefixWithoutDueBy = prefix.slice(0, dueByMatch.index);
    cleanedTitle = (prefixWithoutDueBy + suffix).trim();
  } else {
    cleanedTitle = (prefix + suffix).trim();
  }

  cleanedTitle = cleanedTitle
    .replace(/\s+(at|on|for|in|from|scheduled for|starting at)$/i, "")
    .trim();
  cleanedTitle = cleanedTitle.replace(/^(at|on|for|in|from)\s+/i, "").trim();
  cleanedTitle = cleanedTitle.replace(/\s+/g, " ");

  if (!cleanedTitle) {
    return null;
  }

  return {
    cleanedTitle,
    matchedText: result.text,
    date,
    field,
    hasTime,
  };
}

/**
 * Formats the detected NLP date for display inside the compact matte chip.
 * e.g. "Do: Tomorrow" or "Due: Fri, Nov 27"
 */
export function formatTaskNlpChip(
  field: "do_date" | "due_date",
  date: Date,
  hasTime = false,
): string {
  const prefix = field === "do_date" ? "Do: " : "Due: ";
  let datePart = "";

  if (isToday(date)) {
    datePart = "Today";
  } else if (isTomorrow(date)) {
    datePart = "Tomorrow";
  } else {
    datePart = format(date, "EEE, MMM d");
  }

  if (hasTime) {
    datePart += ` ${format(date, "h:mm a")}`;
  }

  return `${prefix}${datePart}`;
}
