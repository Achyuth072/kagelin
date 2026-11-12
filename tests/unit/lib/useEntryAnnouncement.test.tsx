import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useEntryAnnouncement } from "@/lib/hooks/useEntryAnnouncement";
import { ENTRY_VALUE_DONE, ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";
import type { StoredEntry } from "@/lib/utils/habit-entry-cycle";

describe("useEntryAnnouncement", () => {
  it("announces Habit completed when cycling to done", () => {
    const { result, rerender } = renderHook(
      ({ stored, stateText }: { stored: StoredEntry; stateText: string }) =>
        useEntryAnnouncement(stored, stateText),
      {
        initialProps: { stored: null as StoredEntry, stateText: "not logged" },
      },
    );

    expect(result.current.liveRegion.props.children).toBe("");

    act(() => {
      result.current.onActivate();
    });

    rerender({ stored: ENTRY_VALUE_DONE, stateText: "done" });

    expect(result.current.liveRegion.props.children).toBe("Habit completed");
  });

  it("announces Habit skipped as rest day, tap again to clear when cycling to skipped", () => {
    const { result, rerender } = renderHook(
      ({ stored, stateText }: { stored: StoredEntry; stateText: string }) =>
        useEntryAnnouncement(stored, stateText),
      {
        initialProps: {
          stored: ENTRY_VALUE_DONE as StoredEntry,
          stateText: "done",
        },
      },
    );

    act(() => {
      result.current.onActivate();
    });

    rerender({ stored: ENTRY_VALUE_SKIPPED, stateText: "skipped" });

    expect(result.current.liveRegion.props.children).toBe(
      "Habit skipped as rest day, tap again to clear",
    );
  });

  it("announces Habit entry cleared when cycling to null", () => {
    const { result, rerender } = renderHook(
      ({ stored, stateText }: { stored: StoredEntry; stateText: string }) =>
        useEntryAnnouncement(stored, stateText),
      {
        initialProps: {
          stored: ENTRY_VALUE_SKIPPED as StoredEntry,
          stateText: "skipped",
        },
      },
    );

    act(() => {
      result.current.onActivate();
    });

    rerender({ stored: null, stateText: "not logged" });

    expect(result.current.liveRegion.props.children).toBe(
      "Habit entry cleared",
    );
  });
});
