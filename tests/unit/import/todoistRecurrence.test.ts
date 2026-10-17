import { describe, it, expect } from "vitest";
import { parseTodoistDateAndRecurrence } from "@/lib/import/todoist/recurrence";

describe("Todoist Recurrence & Date Mapper", () => {
  // Use a fixed reference date: Wednesday, 2026-10-14 (day 3: Sunday=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6)
  const refDate = new Date("2026-10-14T10:00:00.000Z");

  describe("Recurrence rule parsing", () => {
    it("parses daily strict recurrence", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "every day",
        refDate,
      });

      expect(result.recurrence).toEqual({
        freq: "DAILY",
        interval: 1,
        mode: "strict",
      });
      // Anchored to reference date
      expect(result.dueDate).toBeDefined();
    });

    it("parses flexible completion-anchored recurrence (every!)", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "every! 3 days",
        refDate,
      });

      expect(result.recurrence).toEqual({
        freq: "DAILY",
        interval: 3,
        mode: "flexible",
      });
    });

    it("parses weekly weekday patterns (every weekday / workday)", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "every weekday",
        refDate,
      });

      expect(result.recurrence).toEqual({
        freq: "WEEKLY",
        interval: 1,
        days: [1, 2, 3, 4, 5],
        mode: "strict",
      });
      // 2026-10-14 is Wednesday (weekday), so it anchors to 2026-10-14
      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-14");
    });

    it("parses specific weekdays (every mon, fri)", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "every mon, fri",
        refDate,
      });

      expect(result.recurrence).toEqual({
        freq: "WEEKLY",
        interval: 1,
        days: [1, 5],
        mode: "strict",
      });
      // Wed 2026-10-14: next is Friday 2026-10-16
      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-16");
    });

    it("parses monthly and yearly intervals", () => {
      const monthly = parseTodoistDateAndRecurrence({
        dateStr: "every 2 months",
        refDate,
      });
      expect(monthly.recurrence).toEqual({
        freq: "MONTHLY",
        interval: 2,
        mode: "strict",
      });

      const yearly = parseTodoistDateAndRecurrence({
        dateStr: "yearly",
        refDate,
      });
      expect(yearly.recurrence).toEqual({
        freq: "YEARLY",
        interval: 1,
        mode: "strict",
      });
    });
  });

  describe("Date and Deadline splitting", () => {
    it("assigns DEADLINE to due_date and DATE to do_date when both are present", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "2026-10-20",
        deadlineStr: "2026-10-25",
        refDate,
      });

      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-25");
      expect(result.doDate?.slice(0, 10)).toBe("2026-10-20");
      expect(result.recurrence).toBeNull();
    });

    it("assigns single non-recurring DATE to due_date", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "2026-10-20 14:00",
        refDate,
      });

      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-20");
      expect(result.doDate).toBeNull();
    });

    it("assigns single DEADLINE to due_date", () => {
      const result = parseTodoistDateAndRecurrence({
        deadlineStr: "2026-10-31",
        refDate,
      });

      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-31");
      expect(result.doDate).toBeNull();
    });

    it("handles natural language date strings like 'tomorrow' or 'today at 11:00'", () => {
      const result = parseTodoistDateAndRecurrence({
        dateStr: "today at 11:00",
        refDate,
      });

      expect(result.dueDate).toBeDefined();
      expect(result.dueDate?.slice(0, 10)).toBe("2026-10-14");
    });
  });
});
