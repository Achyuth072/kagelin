import { describe, it, expect } from "vitest";
import { buildLogbookItems } from "@/components/tasks/logbookItems";
import type { Task } from "@/lib/types/task";

// Saturday, 10 October 2026, 18:00 local.
const NOW = new Date(2026, 9, 10, 18, 0);

function done(id: string, daysAgo: number): Task {
  const at = new Date(NOW);
  at.setDate(at.getDate() - daysAgo);
  at.setHours(9, 0, 0, 0);
  return { id, completed_at: at.toISOString() } as Task;
}

const shape = (items: ReturnType<typeof buildLogbookItems>) =>
  items.map((item) =>
    item.type === "header"
      ? `# ${item.title}`
      : item.type === "more"
        ? `more ${item.count}`
        : item.task.id,
  );

describe("buildLogbookItems", () => {
  const tasks = [
    done("week", 3),
    done("sep-a", 20),
    done("yesterday", 1),
    done("aug", 60),
    done("sep-b", 25),
    done("jul", 90),
  ];

  it("lists the last 30 days newest first, by month after this week, then offers the rest", () => {
    expect(
      shape(buildLogbookItems(tasks, { now: NOW, showOlder: false })),
    ).toEqual([
      "# Yesterday",
      "yesterday",
      "# This Week",
      "week",
      "# September 2026",
      "sep-a",
      "sep-b",
      "more 2",
    ]);
  });

  it("shows every month once older tasks are asked for", () => {
    expect(
      shape(buildLogbookItems(tasks, { now: NOW, showOlder: true })),
    ).toEqual([
      "# Yesterday",
      "yesterday",
      "# This Week",
      "week",
      "# September 2026",
      "sep-a",
      "sep-b",
      "# August 2026",
      "aug",
      "# July 2026",
      "jul",
    ]);
  });
});
