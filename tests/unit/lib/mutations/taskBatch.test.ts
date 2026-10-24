import { describe, it, expect, beforeEach, vi } from "vitest";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore, STORAGE_KEY } from "@/lib/mock/mock-store";

describe("taskMutations.createMany", () => {
  beforeEach(() => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
  });

  it("creates every task in the batch", async () => {
    const created = await taskMutations.createMany([
      { content: "One" },
      { content: "Two" },
      { content: "Three" },
    ]);

    expect(created).toHaveLength(3);
    expect(created.map((task) => task.content)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(mockStore.getTasks().map((task) => task.content)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("writes the whole batch to the guest store in one save", async () => {
    const setItem = vi.spyOn(window.localStorage, "setItem");
    setItem.mockClear();

    await taskMutations.createMany([
      { content: "One" },
      { content: "Two" },
      { content: "Three" },
    ]);

    const storeWrites = setItem.mock.calls.filter(
      ([key]) => key === STORAGE_KEY,
    );
    expect(storeWrites).toHaveLength(1);
  });

  it("keeps the batch order in day_order", async () => {
    const created = await taskMutations.createMany([
      { content: "One" },
      { content: "Two" },
      { content: "Three" },
    ]);

    expect(created[0].day_order).toBeLessThan(created[1].day_order);
    expect(created[1].day_order).toBeLessThan(created[2].day_order);
  });

  it("creates nothing for an empty batch", async () => {
    const created = await taskMutations.createMany([]);

    expect(created).toEqual([]);
    expect(mockStore.getTasks()).toHaveLength(0);
  });
});
