import { describe, it, expect } from "vitest";
import {
  composeBriefing,
  type BriefingCounts,
} from "../../supabase/functions/_shared/compose-briefing";

const none: BriefingCounts = {
  tasksToday: 0,
  overdue: 0,
  dueToday: 0,
  eventsToday: 0,
  habitsPending: 0,
};

describe("composeBriefing", () => {
  it("returns nothing when every count is zero", () => {
    expect(composeBriefing(none)).toBeNull();
  });

  it("still produces a brief for a day with events and no tasks", () => {
    const brief = composeBriefing({ ...none, eventsToday: 2 });
    expect(brief?.body).toBe("You have 2 events.");
  });

  it("omits zero-valued parts", () => {
    const brief = composeBriefing({ ...none, tasksToday: 3, overdue: 1 });
    expect(brief?.body).toBe("You have 3 tasks, 1 overdue.");
    expect(brief?.body).not.toMatch(/event|habit|due today/);
  });

  it("lists every non-zero part in a fixed order", () => {
    const brief = composeBriefing({
      tasksToday: 1,
      overdue: 2,
      dueToday: 3,
      eventsToday: 1,
      habitsPending: 4,
    });
    expect(brief?.body).toBe(
      "You have 1 task, 2 overdue, 3 due today, 1 event, 4 habits pending.",
    );
  });

  it("counts a lone habit in the singular", () => {
    expect(composeBriefing({ ...none, habitsPending: 1 })?.body).toBe(
      "You have 1 habit pending.",
    );
  });

  it("opens Home and carries no actions", () => {
    const brief = composeBriefing({ ...none, tasksToday: 1 });
    expect(brief?.title).toBe("Morning Briefing");
    expect(brief?.data).toEqual({ url: "/" });
    expect(brief).not.toHaveProperty("actions");
  });
});
