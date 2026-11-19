import { describe, it, expect } from "vitest";
import {
  formatDoDate,
  isRescheduleNeeded,
} from "@/components/tasks/task-utils";

describe("task-utils schedule disambiguation", () => {
  const referenceToday = new Date("2026-11-19T12:00:00Z");

  describe("isRescheduleNeeded", () => {
    it("returns false when do_date is null or undefined", () => {
      expect(isRescheduleNeeded(null, false, referenceToday)).toBe(false);
      expect(isRescheduleNeeded(undefined, false, referenceToday)).toBe(false);
    });

    it("returns false when task is completed even if do_date is past", () => {
      expect(isRescheduleNeeded("2026-11-10", true, referenceToday)).toBe(
        false,
      );
    });

    it("returns false when do_date is today or in the future", () => {
      expect(isRescheduleNeeded("2026-11-19", false, referenceToday)).toBe(
        false,
      );
      expect(isRescheduleNeeded("2026-11-20", false, referenceToday)).toBe(
        false,
      );
    });

    it("returns true when uncompleted task has do_date in the past", () => {
      expect(isRescheduleNeeded("2026-11-18", false, referenceToday)).toBe(
        true,
      );
      expect(isRescheduleNeeded("2026-10-01", false, referenceToday)).toBe(
        true,
      );
    });
  });

  describe("formatDoDate", () => {
    it("returns 'Planned Today' when do_date is today", () => {
      const res = formatDoDate("2026-11-19", false, referenceToday);
      expect(res).toEqual({
        text: "Planned Today",
        isPlannedToday: true,
        isRescheduleNeeded: false,
      });
    });

    it("returns 'Planned for [date]' and flags reschedule_needed when uncompleted and past", () => {
      const res = formatDoDate("2026-11-15", false, referenceToday);
      expect(res).toEqual({
        text: "Planned for Nov 15",
        isPlannedToday: false,
        isRescheduleNeeded: true,
      });
    });

    it("returns standard date text and does not flag reschedule_needed when completed", () => {
      const res = formatDoDate("2026-11-15", true, referenceToday);
      expect(res).toEqual({
        text: "Nov 15",
        isPlannedToday: false,
        isRescheduleNeeded: false,
      });
    });

    it("returns standard date text and does not flag reschedule_needed when in future", () => {
      const res = formatDoDate("2026-11-25", false, referenceToday);
      expect(res).toEqual({
        text: "Nov 25",
        isPlannedToday: false,
        isRescheduleNeeded: false,
      });
    });
  });
});
