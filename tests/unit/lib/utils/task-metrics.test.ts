import { describe, it, expect } from "vitest";
import {
  getTaskTotalCompletions,
  getTaskOnTimeRate,
  categorizeTaskSchedule,
  type TaskOccurrence,
} from "@/lib/utils/task-metrics";
import * as taskMetricsModule from "@/lib/utils/task-metrics";

function occ(
  dueDate: string | null,
  isCompleted: boolean,
  completedAt: string | null = null,
): TaskOccurrence {
  return {
    due_date: dueDate ? `${dueDate}T09:00:00.000Z` : null,
    is_completed: isCompleted,
    completed_at: completedAt ? `${completedAt}T09:00:00.000Z` : null,
  };
}

// Reference test date: Thursday, 2026-06-25 at 10:00:00 local time
const today = new Date("2026-06-25T10:00:00");

describe("getTaskTotalCompletions", () => {
  it("returns 0 when occurrences array is empty", () => {
    expect(getTaskTotalCompletions([])).toBe(0);
  });

  it("returns 0 when no occurrences are completed", () => {
    const occurrences = [occ("2026-06-18", false), occ("2026-06-25", false)];
    expect(getTaskTotalCompletions(occurrences)).toBe(0);
  });

  it("accurately counts completed occurrences regardless of due date or schedule", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", false),
      occ("2026-06-18", true, "2026-06-18"),
      occ(null, true, "2026-06-20"), // completed without due date
    ];
    expect(getTaskTotalCompletions(occurrences)).toBe(3);
  });
});

describe("getTaskOnTimeRate", () => {
  it("returns null when occurrences list is empty", () => {
    expect(getTaskOnTimeRate([])).toBeNull();
  });

  it("returns null when no occurrences have been completed", () => {
    const occurrences = [occ("2026-06-18", false), occ("2026-06-25", false)];
    expect(getTaskOnTimeRate(occurrences)).toBeNull();
  });

  it("returns null when completed occurrences have no due date", () => {
    const occurrences = [occ(null, true, "2026-06-20")];
    expect(getTaskOnTimeRate(occurrences)).toBeNull();
  });

  it("treats completion on or before due date as on-time (100% on-time)", () => {
    const occurrences = [
      occ("2026-06-18", true, "2026-06-18"),
      occ("2026-06-25", true, "2026-06-24"), // completed early
    ];
    expect(getTaskOnTimeRate(occurrences)).toBe(1);
  });

  it("calculates the proportion of on-time completions against late completions", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"), // on time
      occ("2026-06-11", true, "2026-06-13"), // 2 days late
      occ("2026-06-18", false), // incomplete, should not affect denominator
    ];
    expect(getTaskOnTimeRate(occurrences)).toBe(0.5);
  });
});

describe("categorizeTaskSchedule", () => {
  it("classifies tasks with no dates as unscheduled", () => {
    expect(categorizeTaskSchedule({}, today)).toBe("unscheduled");
    expect(
      categorizeTaskSchedule({ due_date: null, do_date: null }, today),
    ).toBe("unscheduled");
  });

  it("classifies tasks with do_date today as planned_today", () => {
    expect(
      categorizeTaskSchedule({ do_date: "2026-06-25T09:00:00.000Z" }, today),
    ).toBe("planned_today");
    expect(
      categorizeTaskSchedule(
        {
          do_date: "2026-06-25T08:00:00.000Z",
          due_date: "2026-07-01T12:00:00.000Z",
        },
        today,
      ),
    ).toBe("planned_today");
  });

  it("classifies tasks with expired do_date as reschedule_needed when not completed", () => {
    expect(
      categorizeTaskSchedule(
        { do_date: "2026-06-24T18:00:00.000Z", is_completed: false },
        today,
      ),
    ).toBe("reschedule_needed");
    expect(
      categorizeTaskSchedule(
        {
          do_date: "2026-06-20T09:00:00.000Z",
          due_date: "2026-06-30T17:00:00.000Z", // future due date
          is_completed: false,
        },
        today,
      ),
    ).toBe("reschedule_needed");
  });

  it("classifies tasks with due_date today as due_today", () => {
    expect(
      categorizeTaskSchedule({ due_date: "2026-06-25T17:00:00.000Z" }, today),
    ).toBe("due_today");
  });

  it("classifies tasks with expired due_date as overdue when not completed", () => {
    expect(
      categorizeTaskSchedule(
        { due_date: "2026-06-24T17:00:00.000Z", is_completed: false },
        today,
      ),
    ).toBe("overdue");
  });

  it("prioritizes overdue commitment over planned_today when both dates exist", () => {
    // Contractual deadline already expired; overdue takes precedence
    expect(
      categorizeTaskSchedule(
        {
          due_date: "2026-06-24T12:00:00.000Z", // yesterday (overdue)
          do_date: "2026-06-25T09:00:00.000Z", // today
          is_completed: false,
        },
        today,
      ),
    ).toBe("overdue");
  });

  it("prioritizes due_today over expired do_date replanning", () => {
    expect(
      categorizeTaskSchedule(
        {
          due_date: "2026-06-25T17:00:00.000Z", // today
          do_date: "2026-06-23T09:00:00.000Z", // expired plan
          is_completed: false,
        },
        today,
      ),
    ).toBe("due_today");
  });

  it("prioritizes planned_today when both dates are today", () => {
    expect(
      categorizeTaskSchedule(
        {
          due_date: "2026-06-25T17:00:00.000Z", // today
          do_date: "2026-06-25T09:00:00.000Z", // today
          is_completed: false,
        },
        today,
      ),
    ).toBe("planned_today");
  });

  it("does not classify completed tasks as overdue or reschedule_needed", () => {
    expect(
      categorizeTaskSchedule(
        { due_date: "2026-06-24T17:00:00.000Z", is_completed: true },
        today,
      ),
    ).toBe("scheduled");
    expect(
      categorizeTaskSchedule(
        { do_date: "2026-06-24T17:00:00.000Z", is_completed: true },
        today,
      ),
    ).toBe("scheduled");
  });

  it("classifies future scheduled dates as scheduled", () => {
    expect(
      categorizeTaskSchedule({ due_date: "2026-06-30T17:00:00.000Z" }, today),
    ).toBe("scheduled");
    expect(
      categorizeTaskSchedule({ do_date: "2026-06-26T09:00:00.000Z" }, today),
    ).toBe("scheduled");
  });
});

describe("Anti-encroachment invariants", () => {
  it("exports zero streak, cadence, or habit score calculation functions", () => {
    const exportedKeys = Object.keys(taskMetricsModule);
    const bannedTerms = ["streak", "cadence", "score", "decay", "heatmap"];
    for (const key of exportedKeys) {
      for (const term of bannedTerms) {
        expect(key.toLowerCase()).not.toContain(term);
      }
    }
  });
});
