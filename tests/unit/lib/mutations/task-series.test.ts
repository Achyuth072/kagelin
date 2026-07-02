import { describe, it, expect, beforeEach } from "vitest";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";

beforeEach(() => {
  localStorage.setItem("kanso_guest_mode", "true");
  mockStore.clearData();
});

describe("recurring_series_id", () => {
  describe("create", () => {
    it("stamps a recurring_series_id when recurrence is set", async () => {
      const task = await taskMutations.create({
        content: "Daily standup",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      expect(task.recurring_series_id).toBeDefined();
      expect(task.recurring_series_id).not.toBeNull();
    });

    it("leaves recurring_series_id null when no recurrence", async () => {
      const task = await taskMutations.create({
        content: "One-off task",
      });

      expect(task.recurring_series_id).toBeNull();
    });
  });

  describe("update", () => {
    it("stamps a recurring_series_id when adding recurrence to existing task", async () => {
      const task = await taskMutations.create({
        content: "Will become recurring",
      });

      expect(task.recurring_series_id).toBeNull();

      const updated = await taskMutations.update({
        id: task.id,
        recurrence: { freq: "WEEKLY", interval: 1 },
      });

      expect(updated.recurring_series_id).toBeDefined();
      expect(updated.recurring_series_id).not.toBeNull();
    });

    it("does not overwrite existing series id when recurrence already set", async () => {
      const task = await taskMutations.create({
        content: "Already recurring",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      const originalSeriesId = task.recurring_series_id;

      const updated = await taskMutations.update({
        id: task.id,
        content: "Renamed recurring",
      });

      expect(updated.recurring_series_id).toBe(originalSeriesId);
    });
  });

  describe("toggle", () => {
    it("carries recurring_series_id onto spawned Occurrence", async () => {
      const task = await taskMutations.create({
        content: "Weekly review",
        recurrence: { freq: "WEEKLY", interval: 1 },
      });

      const seriesId = task.recurring_series_id;
      expect(seriesId).not.toBeNull();

      const { newRecurringTask } = await taskMutations.toggle({
        id: task.id,
        is_completed: true,
      });

      expect(newRecurringTask).toBeDefined();
      expect(newRecurringTask!.recurring_series_id).toBe(seriesId);
    });

    it("self-heals when parent lacks series id", async () => {
      const task = await taskMutations.create({
        content: "Legacy recurring",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      mockStore.updateTask(task.id, { recurring_series_id: null });

      const { task: updated, newRecurringTask } = await taskMutations.toggle({
        id: task.id,
        is_completed: true,
      });

      expect(updated.recurring_series_id).not.toBeNull();
      expect(newRecurringTask!.recurring_series_id).toBe(
        updated.recurring_series_id,
      );
    });
  });
});
