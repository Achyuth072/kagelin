import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseTaskInput, formatTaskNlpChip } from "@/lib/utils/nlp-task";

describe("parseTaskInput", () => {
  // Fixed reference date: Wednesday, Nov 25, 2026, 10:00:00 UTC
  const refDate = new Date("2026-11-25T10:00:00Z");

  it('parses "Call dentist tomorrow" as do_date', () => {
    const result = parseTaskInput("Call dentist tomorrow", refDate);
    expect(result).not.toBeNull();
    expect(result?.cleanedTitle).toBe("Call dentist");
    expect(result?.matchedText).toBe("tomorrow");
    expect(result?.field).toBe("do_date");
    expect(result?.hasTime).toBe(false);
    expect(result?.date.getDate()).toBe(26);
    expect(result?.date.getMonth()).toBe(10); // November (0-indexed)
  });

  it('parses "Submit report by Friday" as due_date', () => {
    const result = parseTaskInput("Submit report by Friday", refDate);
    expect(result).not.toBeNull();
    expect(result?.cleanedTitle).toBe("Submit report");
    expect(result?.matchedText).toBe("Friday");
    expect(result?.field).toBe("due_date");
    expect(result?.hasTime).toBe(false);
    expect(result?.date.getDay()).toBe(5); // Friday
  });

  it('parses "Submit report due Friday" as due_date', () => {
    const result = parseTaskInput("Submit report due Friday", refDate);
    expect(result).not.toBeNull();
    expect(result?.cleanedTitle).toBe("Submit report");
    expect(result?.field).toBe("due_date");
  });

  it('returns null for "Read 1984" (no date matched)', () => {
    const result = parseTaskInput("Read 1984", refDate);
    expect(result).toBeNull();
  });

  it('returns null for safety guard when stripped title is empty ("Tomorrow")', () => {
    const result = parseTaskInput("Tomorrow", refDate);
    expect(result).toBeNull();
  });

  it('returns null for "by Friday" or "due tomorrow" (empty title safety guard)', () => {
    expect(parseTaskInput("by Friday", refDate)).toBeNull();
    expect(parseTaskInput("due tomorrow", refDate)).toBeNull();
  });

  it("returns null for inputs shorter than 3 characters", () => {
    expect(parseTaskInput("", refDate)).toBeNull();
    expect(parseTaskInput("a", refDate)).toBeNull();
    expect(parseTaskInput("ab", refDate)).toBeNull();
  });

  it('parses "Meeting on May 12 at 3pm" with time and strips dangling preposition', () => {
    const result = parseTaskInput("Meeting on May 12 at 3pm", refDate);
    expect(result).not.toBeNull();
    expect(result?.cleanedTitle).toBe("Meeting");
    expect(result?.field).toBe("do_date");
    expect(result?.hasTime).toBe(true);
    expect(result?.date.getHours()).toBe(15);
    expect(result?.date.getMonth()).toBe(4); // May
    expect(result?.date.getDate()).toBe(12);
  });
});

describe("formatTaskNlpChip", () => {
  const refDate = new Date("2026-11-25T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(refDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats tomorrow do_date as Do: Tomorrow", () => {
    const tomorrow = new Date(refDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatTaskNlpChip("do_date", tomorrow)).toBe("Do: Tomorrow");
  });

  it("formats arbitrary due_date as Due: Fri, Nov 27", () => {
    const target = new Date("2026-11-27T12:00:00Z");
    expect(formatTaskNlpChip("due_date", target)).toMatch(/Due: Fri, Nov 27/);
  });

  it("formats time when hasTime is true", () => {
    const target = new Date("2026-11-27T15:00:00");
    expect(formatTaskNlpChip("do_date", target, true)).toMatch(
      /Do: Fri, Nov 27 3:00 PM/,
    );
  });
});
