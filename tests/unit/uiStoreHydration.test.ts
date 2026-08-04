import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";

/**
 * Seeds persisted state, rehydrates, and waits for _hasHydrated. `version` is
 * deliberately a parameter: zustand only runs migrate() when the stored version
 * differs from the store's, so the migration cases must seed a stale one.
 */
async function rehydrateFrom(
  state: Record<string, unknown>,
  version: number,
): Promise<ReturnType<typeof useUiStore.getState>> {
  localStorage.setItem("kanso-ui-state", JSON.stringify({ state, version }));
  await useUiStore.persist.rehydrate();

  if (!useUiStore.getState()._hasHydrated) {
    await new Promise((resolve) => {
      const unsub = useUiStore.subscribe((s) => {
        if (s._hasHydrated) {
          unsub();
          resolve(true);
        }
      });
      setTimeout(() => {
        unsub();
        resolve(false);
      }, 1000);
    });
  }

  return useUiStore.getState();
}

describe("uiStore Hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("should initialize with default values when localStorage is empty", () => {
    const state = useUiStore.getState();
    expect(state.timeFormat).toBe("system");
    expect(state.viewMode).toBe("list");
    expect(state.sortBy).toBe("date");
  });

  it("should rehydrate values from localStorage and set _hasHydrated to true", async () => {
    const state = await rehydrateFrom(
      { timeFormat: "24h", viewMode: "list", sortBy: "priority" },
      1,
    );

    expect(state._hasHydrated).toBe(true);
    expect(state.timeFormat).toBe("24h");
    expect(state.viewMode).toBe("list");
  });

  it.each(["grid", "split"])(
    "migrates a retired '%s' viewMode to 'list'",
    async (retired) => {
      const state = await rehydrateFrom({ viewMode: retired }, 0);

      expect(state.viewMode).toBe("list");
    },
  );

  it("preserves other persisted keys when migrating a retired viewMode", async () => {
    const state = await rehydrateFrom(
      { viewMode: "grid", timeFormat: "24h", sortBy: "priority" },
      0,
    );

    expect(state.viewMode).toBe("list");
    expect(state.timeFormat).toBe("24h");
    expect(state.sortBy).toBe("priority");
  });

  it("leaves a still-supported viewMode untouched across a version bump", async () => {
    const state = await rehydrateFrom({ viewMode: "board" }, 0);

    expect(state.viewMode).toBe("board");
  });
});
