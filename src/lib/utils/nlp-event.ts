import * as chrono from "chrono-node";

export interface ParsedEventInput {
  title: string;
  start?: Date;
  end?: Date;
  allDay: boolean;
}

/**
 * Parses a natural language string into event components.
 *
 * @param input - The raw text input (e.g., "Lunch at 1pm tomorrow")
 * @param refDate - The reference date for relative parsing (defaults to today)
 * @returns ParsedEventInput with title, start, end, and allDay flag
 */
export function parseEventInput(
  input: string,
  refDate: Date = new Date(),
): ParsedEventInput {
  const trimmed = input.trim();
  if (!trimmed) {
    return { title: "", allDay: false };
  }

  const results = chrono.parse(trimmed, refDate);

  if (results.length === 0) {
    return { title: trimmed, allDay: false };
  }

  const result = results[0];
  const start = result.start.date();
  const end = result.end
    ? result.end.date()
    : new Date(start.getTime() + 3600000);

  // result.text is just the matched date fragment (e.g. "1pm" or "at 1pm" out
  // of "Lunch at 1pm"); strip it and any filler word left dangling by the cut.
  let title = trimmed.replace(result.text, "").trim();
  title = title
    .replace(/\s+(at|on|for|in|from|scheduled for|starting at)$/i, "")
    .trim();
  title = title.replace(/^(at|on|for|in|from)\s+/i, "").trim();

  if (!title) {
    title = "Untitled Event";
  }

  const allDay =
    result.start.isCertain("day") && !result.start.isCertain("hour");

  return {
    title,
    start,
    end,
    allDay,
  };
}
