import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      isProjectsOpen: true,
      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
      hapticsEnabled: true,
      isShortcutsHelpOpen: false,
    });
  });

  it("does not persist open dialogs, so none reopens on the next launch", () => {
    const { partialize } = useUiStore.persist.getOptions();
    const persisted = partialize!({
      ...useUiStore.getState(),
      isShortcutsHelpOpen: true,
      isArchivedProjectsOpen: true,
      isChangelogOpen: true,
    }) as Record<string, unknown>;

    expect(persisted).not.toHaveProperty("isShortcutsHelpOpen");
    expect(persisted).not.toHaveProperty("isArchivedProjectsOpen");
    expect(persisted).not.toHaveProperty("isChangelogOpen");
  });

  it("ignores an open dialog saved by an older build", () => {
    const { merge } = useUiStore.persist.getOptions();
    const merged = merge!(
      { isShortcutsHelpOpen: true, isChangelogOpen: true, sortBy: "priority" },
      useUiStore.getState(),
    );

    expect(merged.isShortcutsHelpOpen).toBe(false);
    expect(merged.isChangelogOpen).toBe(false);
    expect(merged.sortBy).toBe("priority");
  });

  it("should have correct initial values", () => {
    const state = useUiStore.getState();
    expect(state.isProjectsOpen).toBe(true);
    expect(state.sortBy).toBe("date");
    expect(state.viewMode).toBe("list");
  });

  it("should toggle projects visibility", () => {
    useUiStore.getState().toggleProjectsOpen();
    expect(useUiStore.getState().isProjectsOpen).toBe(false);

    useUiStore.getState().toggleProjectsOpen();
    expect(useUiStore.getState().isProjectsOpen).toBe(true);
  });

  it("should update sort options", () => {
    useUiStore.getState().setSortBy("priority");
    expect(useUiStore.getState().sortBy).toBe("priority");
  });

  it("should update view mode", () => {
    useUiStore.getState().setViewMode("board");
    expect(useUiStore.getState().viewMode).toBe("board");
  });

  it("should handle haptics toggle", () => {
    useUiStore.getState().setHapticsEnabled(false);
    expect(useUiStore.getState().hapticsEnabled).toBe(false);
  });

  it("should handle shortcutTipsEnabled toggle", () => {
    expect(useUiStore.getState().shortcutTipsEnabled).toBe(true);
    useUiStore.getState().setShortcutTipsEnabled(false);
    expect(useUiStore.getState().shortcutTipsEnabled).toBe(false);
  });

  it("persists shortcutTipsEnabled and shownShortcutTips but excludes ephemeral shortcutMouseCounts", () => {
    const { partialize } = useUiStore.persist.getOptions();
    useUiStore.setState({
      shortcutTipsEnabled: false,
      shownShortcutTips: { newTask: true },
      shortcutMouseCounts: { newTask: 2 },
    });
    const persisted = partialize!(useUiStore.getState()) as Record<
      string,
      unknown
    >;
    expect(persisted.shortcutTipsEnabled).toBe(false);
    expect(persisted.shownShortcutTips).toEqual({ newTask: true });
    expect(persisted.shortcutMouseCounts).toBeUndefined();
  });

  it("handles incrementShortcutMouseCount atomically up to threshold", () => {
    useUiStore.setState({
      shownShortcutTips: {},
      shortcutMouseCounts: {},
    });

    const first = useUiStore
      .getState()
      .incrementShortcutMouseCount("newTask", 3);
    expect(first).toBe(false);
    expect(useUiStore.getState().shortcutMouseCounts.newTask).toBe(1);
    expect(useUiStore.getState().shownShortcutTips.newTask).toBeUndefined();

    const second = useUiStore
      .getState()
      .incrementShortcutMouseCount("newTask", 3);
    expect(second).toBe(false);
    expect(useUiStore.getState().shortcutMouseCounts.newTask).toBe(2);

    const third = useUiStore
      .getState()
      .incrementShortcutMouseCount("newTask", 3);
    expect(third).toBe(true);
    expect(useUiStore.getState().shortcutMouseCounts.newTask).toBe(3);
    expect(useUiStore.getState().shownShortcutTips.newTask).toBe(true);

    // Once marked shown, subsequent increments return false and do not re-trigger
    const fourth = useUiStore
      .getState()
      .incrementShortcutMouseCount("newTask", 3);
    expect(fourth).toBe(false);
  });

  it("should handle shortcuts help dialog toggle", () => {
    useUiStore.getState().setShortcutsHelpOpen(true);
    expect(useUiStore.getState().isShortcutsHelpOpen).toBe(true);

    useUiStore.getState().setShortcutsHelpOpen((prev) => !prev);
    expect(useUiStore.getState().isShortcutsHelpOpen).toBe(false);
  });

  describe("isFullscreen", () => {
    it("should default to false", () => {
      expect(useUiStore.getState().isFullscreen).toBe(false);
    });

    it("should allow setting fullscreen state", () => {
      useUiStore.getState().setIsFullscreen(true);
      expect(useUiStore.getState().isFullscreen).toBe(true);

      useUiStore.getState().setIsFullscreen(false);
      expect(useUiStore.getState().isFullscreen).toBe(false);
    });
  });

  describe("isSynced", () => {
    it("should default to false", () => {
      expect(useUiStore.getState().isSynced).toBe(false);
    });

    it("should allow setting sync state", () => {
      useUiStore.getState().setIsSynced(true);
      expect(useUiStore.getState().isSynced).toBe(true);

      useUiStore.getState().setIsSynced(false);
      expect(useUiStore.getState().isSynced).toBe(false);
    });
  });
});
