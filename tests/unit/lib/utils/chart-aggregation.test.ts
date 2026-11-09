import { describe, it, expect } from "vitest";
import {
  getTrendGranularity,
  aggregateTrendData,
} from "@/lib/utils/chart-aggregation";

describe("chart-aggregation", () => {
  describe("getTrendGranularity", () => {
    it("maps 7d and 30d to day", () => {
      expect(getTrendGranularity("7d")).toBe("day");
      expect(getTrendGranularity("30d")).toBe("day");
    });

    it("maps 90d to week", () => {
      expect(getTrendGranularity("90d")).toBe("week");
    });

    it("maps 1y and all to month", () => {
      expect(getTrendGranularity("1y")).toBe("month");
      expect(getTrendGranularity("all")).toBe("month");
    });
  });

  describe("aggregateTrendData - daily (7d / 30d)", () => {
    it("preserves daily data points with appropriate labels", () => {
      const dailyData = [
        { date: "2026-11-01", hours: 2.5, tasksCompleted: 4 },
        { date: "2026-11-02", hours: 4.0, tasksCompleted: 6 },
      ];
      const result = aggregateTrendData(
        dailyData,
        "7d",
        new Date("2026-11-02T12:00:00Z"),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2026-11-01",
        label: "Nov 1",
        tooltipLabel: "Sun, Nov 1, 2026",
        hours: 2.5,
        tasksCompleted: 4,
        isCurrent: false,
      });
      expect(result[1]).toEqual({
        date: "2026-11-02",
        label: "Nov 2",
        tooltipLabel: "Mon, Nov 2, 2026",
        hours: 4,
        tasksCompleted: 6,
        isCurrent: true,
      });
    });
  });

  describe("aggregateTrendData - weekly (90d)", () => {
    it("aggregates daily items into Monday-aligned weekly buckets", () => {
      const dailyData = [
        // Week 1 (Oct 26 - Nov 1, 2026)
        { date: "2026-10-26", hours: 2.5, tasksCompleted: 3 },
        { date: "2026-10-27", hours: 3.2, tasksCompleted: 2 },
        // Week 2 (Nov 2 - Nov 8, 2026)
        { date: "2026-11-02", hours: 4.1, tasksCompleted: 5 },
      ];
      const now = new Date("2026-11-04T12:00:00Z"); // inside Week 2

      const result = aggregateTrendData(dailyData, "90d", now);
      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        date: "2026-10-26",
        label: "Oct 26",
        tooltipLabel: "Week of Oct 26, 2026",
        hours: 5.7,
        tasksCompleted: 5,
        isCurrent: false,
      });

      expect(result[1]).toEqual({
        date: "2026-11-02",
        label: "Nov 2",
        tooltipLabel: "Week of Nov 2, 2026 (this week)",
        hours: 4.1,
        tasksCompleted: 5,
        isCurrent: true,
      });
    });
  });

  describe("aggregateTrendData - monthly (1y / all)", () => {
    it("aggregates daily items into monthly buckets", () => {
      const dailyData = [
        // Month 1 (October 2026)
        { date: "2026-10-15", hours: 3.5, tasksCompleted: 4 },
        { date: "2026-10-20", hours: 4.2, tasksCompleted: 2 },
        // Month 2 (November 2026)
        { date: "2026-11-01", hours: 5.0, tasksCompleted: 6 },
      ];
      const now = new Date("2026-11-09T12:00:00Z"); // inside November 2026

      const result = aggregateTrendData(dailyData, "1y", now);
      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        date: "2026-10-01",
        label: "Oct",
        tooltipLabel: "October 2026",
        hours: 7.7,
        tasksCompleted: 6,
        isCurrent: false,
      });

      expect(result[1]).toEqual({
        date: "2026-11-01",
        label: "Nov",
        tooltipLabel: "November 2026 (this month)",
        hours: 5.0,
        tasksCompleted: 6,
        isCurrent: true,
      });
    });

    it("appends 2-digit year to label when multi-year months collide", () => {
      const dailyData = [
        { date: "2025-11-15", hours: 2.0, tasksCompleted: 1 },
        { date: "2026-11-05", hours: 3.0, tasksCompleted: 2 },
      ];
      const now = new Date("2026-11-09T12:00:00Z");

      const result = aggregateTrendData(dailyData, "1y", now);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Nov '25");
      expect(result[1].label).toBe("Nov '26");
    });
  });
});
