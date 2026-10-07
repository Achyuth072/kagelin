import { describe, it, expect } from "vitest";
import {
  composeBriefing,
  type BriefingCounts,
  type EveningCounts,
} from "../../supabase/functions/_shared/compose-briefing";

const none: BriefingCounts = {
  tasksToday: 0,
  overdue: 0,
  dueToday: 0,
  eventsToday: 0,
  habitsPending: 0,
};

const eveningNone: EveningCounts = {
  tasksFinished: 0,
  habitsFinished: 0,
  tasksTomorrow: 0,
  eventsTomorrow: 0,
};

const morning = (counts: Partial<BriefingCounts>) =>
  composeBriefing({ kind: "morning", counts: { ...none, ...counts } });

const CIPHERTEXT = "xchacha20poly1305-v1:abc";

describe("composeBriefing", () => {
  it("returns nothing when every count is zero", () => {
    expect(morning({})).toBeNull();
  });

  it("still produces a brief for a day with events and no tasks", () => {
    expect(morning({ eventsToday: 2 })?.body).toBe("You have 2 events.");
  });

  it("omits zero-valued parts", () => {
    const brief = morning({ tasksToday: 3, overdue: 1 });
    expect(brief?.body).toBe("You have 3 tasks, 1 overdue.");
    expect(brief?.body).not.toMatch(/event|habit|due today/);
  });

  it("lists every non-zero part in a fixed order", () => {
    const brief = composeBriefing({
      kind: "morning",
      counts: {
        tasksToday: 1,
        overdue: 2,
        dueToday: 3,
        eventsToday: 1,
        habitsPending: 4,
      },
    });
    expect(brief?.body).toBe(
      "You have 1 task, 2 overdue, 3 due today, 1 event, 4 habits pending.",
    );
  });

  it("counts a lone habit in the singular", () => {
    expect(morning({ habitsPending: 1 })?.body).toBe(
      "You have 1 habit pending.",
    );
  });

  it("opens Home and carries no actions", () => {
    const brief = morning({ tasksToday: 1 });
    expect(brief?.title).toBe("Morning Briefing");
    expect(brief?.data).toEqual({ url: "/" });
    expect(brief).not.toHaveProperty("actions");
  });
});

describe("composeBriefing evening", () => {
  it("returns nothing when finished and tomorrow counts are all zero", () => {
    expect(
      composeBriefing({ kind: "evening", counts: eveningNone }),
    ).toBeNull();
  });

  it("reports finished work and tomorrow, titled Evening Plan", () => {
    const brief = composeBriefing({
      kind: "evening",
      counts: {
        tasksFinished: 3,
        habitsFinished: 1,
        tasksTomorrow: 2,
        eventsTomorrow: 1,
      },
    });
    expect(brief?.title).toBe("Evening Plan");
    expect(brief?.body).toBe(
      "Finished today: 3 tasks, 1 habit. Tomorrow: 2 tasks, 1 event.",
    );
    expect(brief?.data).toEqual({ url: "/" });
  });

  it("omits the section with nothing in it", () => {
    const finishedOnly = composeBriefing({
      kind: "evening",
      counts: { ...eveningNone, tasksFinished: 1 },
    });
    expect(finishedOnly?.body).toBe("Finished today: 1 task.");

    const tomorrowOnly = composeBriefing({
      kind: "evening",
      counts: { ...eveningNone, eventsTomorrow: 2 },
    });
    expect(tomorrowOnly?.body).toBe("Tomorrow: 2 events.");
  });
});

describe("composeBriefing next-up name", () => {
  it("carries the name only as ciphertext in a single-placeholder template", () => {
    const brief = composeBriefing({
      kind: "morning",
      counts: { ...none, tasksToday: 2 },
      nextUp: { ciphertext: CIPHERTEXT },
    });
    expect(brief?.encrypted).toEqual({
      template: "You have 2 tasks. Next: {}",
      ciphertext: CIPHERTEXT,
    });
    expect(brief?.body).toBe("You have 2 tasks.");
    expect(brief?.encrypted?.template.match(/\{\}/g)).toHaveLength(1);
  });

  it("names the source row of the next-up copy so its binding can be rebuilt", () => {
    const task = composeBriefing({
      kind: "morning",
      counts: { ...none, tasksToday: 1 },
      nextUp: { ciphertext: CIPHERTEXT, taskId: "task-1" },
    });
    const event = composeBriefing({
      kind: "evening",
      counts: { ...eveningNone, eventsTomorrow: 1 },
      nextUp: { ciphertext: CIPHERTEXT, eventId: "event-1" },
    });
    expect(task?.data).toEqual({ url: "/", taskId: "task-1" });
    expect(event?.data).toEqual({ url: "/", eventId: "event-1" });
  });

  it("puts an event's local time before its name", () => {
    const brief = composeBriefing({
      kind: "evening",
      counts: { ...eveningNone, eventsTomorrow: 1 },
      nextUp: { ciphertext: CIPHERTEXT, time: "09:30" },
    });
    expect(brief?.encrypted?.template).toBe(
      "Tomorrow: 1 event. Next: 09:30 {}",
    );
  });

  it("falls back to counts only when no ciphertext is available", () => {
    for (const nextUp of [null, undefined, { ciphertext: "" }]) {
      const brief = composeBriefing({
        kind: "morning",
        counts: { ...none, tasksToday: 1 },
        nextUp,
      });
      expect(brief).not.toHaveProperty("encrypted");
      expect(brief?.body).toBe("You have 1 task.");
    }
  });

  it("does not let a next-up name keep an all-zero day alive", () => {
    expect(
      composeBriefing({
        kind: "morning",
        counts: none,
        nextUp: { ciphertext: CIPHERTEXT },
      }),
    ).toBeNull();
  });
});
