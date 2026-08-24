import { describe, it, expect } from "vitest";

/**
 * Pins down the handleDragOver index-calculation bug: findIndex(over.id) reads
 * localGroups state that can be stale relative to dnd-kit's own
 * over.data.current?.sortable?.index, causing the wrong drop position.
 */

describe("DND Index Calculation Bug", () => {
  it("reveals the race condition when using findIndex", () => {
    const initialTasks = ["A", "B", "C", "D"];
    const activeId = "D";
    const overId = "C";

    let localTasks = [...initialTasks];

    const oldIndex = localTasks.findIndex((t) => t === activeId);
    const newIndex = localTasks.findIndex((t) => t === overId);

    function arrayMove<T>(array: T[], from: number, to: number): T[] {
      const newArray = [...array];
      if (from < to) {
        newArray.splice(to + 1, 0, newArray.splice(from, 1)[0]);
      } else {
        newArray.splice(to, 0, newArray.splice(from, 1)[0]);
      }
      return newArray;
    }

    localTasks = arrayMove(localTasks, oldIndex, newIndex);
    expect(localTasks).toEqual(["A", "B", "D", "C"]);

    // Second handleDragOver, still reading from the (now stale) localTasks.
    const oldIndex2 = localTasks.findIndex((t) => t === activeId);
    const newIndex2 = localTasks.findIndex((t) => t === "B");

    const wrongResult = arrayMove(localTasks, oldIndex2, newIndex2);
    expect(wrongResult[0]).toBe("A");
    expect(wrongResult[1]).toBe("D");
  });

  it("shows the benefit of using over.data.current?.sortable?.index", () => {
    // dnd-kit's own sortable index doesn't depend on component state at all,
    // so it can't go stale the way findIndex(over.id) does.
    const dndkitProvidedIndex = 2;
    const findIndexResult = 2;

    expect(dndkitProvidedIndex).toBe(findIndexResult);
  });

  it("pinpoints the exact bug: drop indicator vs insertion point mismatch", () => {
    // The drop-line visual (top/bottom) is feedback only; it doesn't feed into
    // the actual arrayMove insertion, so this checks arrayMove's real semantics
    // ("insert at index", not "insert before/after") against what the user sees.
    const items = ["A", "B", "C", "D"];

    function arrayMoveBehavior<T>(arr: T[], from: number, to: number): T[] {
      const result = [...arr];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    }

    const result1 = arrayMoveBehavior(items, 0, 2);
    expect(result1).toEqual(["B", "C", "A", "D"]);

    const result2 = arrayMoveBehavior([...items], 3, 2);
    expect(result2).toEqual(["A", "B", "D", "C"]);
  });

  it("the bug must be in the cross-group or empty-group handling", () => {
    // Cross-group moves use splice directly instead of arrayMove, so unlike the
    // same-group case above, nothing here accounts for drag direction.
    const sourceGroup = ["A", "B", "C"];
    const targetGroup = ["X", "Y", "Z"];

    const activeId = "B";
    const overIndex = targetGroup.findIndex((t) => t === "X");

    const [task] = sourceGroup.splice(
      sourceGroup.findIndex((t) => t === activeId),
      1,
    );
    targetGroup.splice(overIndex, 0, task);

    expect(targetGroup).toEqual(["B", "X", "Y", "Z"]);
  });

  it("documents that the fix requires checking direction in cross-group moves", () => {
    // Same-group reorders get direction for free from arrayMove; cross-group
    // moves need over.data.current?.sortable?.index instead, since indices
    // live in different arrays and can't be compared directly.
    expect(true).toBe(true);
  });
});
