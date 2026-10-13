import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { toastMock } = vi.hoisted(() => {
  const toastMock = vi.fn() as unknown as typeof import("sonner").toast;
  Object.assign(toastMock, {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  });
  return { toastMock };
});

vi.mock("sonner", () => ({ toast: toastMock }));

import { useUiStore } from "@/lib/store/uiStore";
import { useShortcutTips } from "@/lib/hooks/useShortcutTips";

describe("useShortcutTips", () => {
  const setFinePointer = (matches: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes("pointer: fine") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setFinePointer(true);
    useUiStore.setState({
      shortcutTipsEnabled: true,
      shownShortcutTips: {},
      shortcutMouseCounts: {},
    });
  });

  it("shows quiet toast on the 3rd mouse action for newTask", () => {
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).not.toHaveBeenCalled();

    act(() => {
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).not.toHaveBeenCalled();

    act(() => {
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      "Tip: press N to do this from anywhere",
      undefined,
    );
  });

  it("never shows the toast again for the same action after threshold is reached", () => {
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("tracks actions independently", () => {
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).toHaveBeenCalledWith(
      "Tip: press N to do this from anywhere",
      undefined,
    );

    act(() => {
      result.current.recordMouseAction("newHabit");
      result.current.recordMouseAction("newHabit");
      result.current.recordMouseAction("newHabit");
    });
    expect(toastMock).toHaveBeenCalledWith(
      "Tip: press H to do this from anywhere",
      undefined,
    );
    expect(toastMock).toHaveBeenCalledTimes(2);
  });

  it("does not fire when shortcutTipsEnabled is false", () => {
    useUiStore.setState({ shortcutTipsEnabled: false });
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("does not fire on non-fine pointer (e.g. mobile touch)", () => {
    setFinePointer(false);
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("fires on device with any-pointer: fine even if primary pointer is coarse", () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes("any-pointer: fine"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      "Tip: press N to do this from anywhere",
      undefined,
    );
  });

  it("suppresses tip if user already triggered action via keyboard shortcut", () => {
    const { result } = renderHook(() => useShortcutTips());

    act(() => {
      result.current.recordKeyAction("newTask");
    });

    act(() => {
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
      result.current.recordMouseAction("newTask");
    });
    expect(toastMock).not.toHaveBeenCalled();
  });
});
