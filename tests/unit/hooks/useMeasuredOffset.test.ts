import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMeasuredOffset } from "@/lib/hooks/useMeasuredOffset";

const CSS_VAR = "--test-measured-offset";

describe("useMeasuredOffset", () => {
  beforeEach(() => {
    document.documentElement.style.setProperty(CSS_VAR, "0px");
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(CSS_VAR);
    vi.unstubAllGlobals();
  });

  it("resets the var to 0px when inactive", () => {
    document.documentElement.style.setProperty(CSS_VAR, "50px");
    const el = document.createElement("div");
    const ref = { current: el };

    renderHook(() => useMeasuredOffset(ref, false, CSS_VAR));

    expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe(
      "0px",
    );
  });

  it("publishes measured border-box height + 12px when active, resets on unmount", () => {
    let observerCallback: ResizeObserverCallback = () => {};
    const mockDisconnect = vi.fn();
    const mockObserve = vi.fn();

    class MockObserver {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = cb;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
    }
    vi.stubGlobal("ResizeObserver", MockObserver);

    const el = document.createElement("div");
    const ref = { current: el };

    const { unmount } = renderHook(() => useMeasuredOffset(ref, true, CSS_VAR));

    expect(mockObserve).toHaveBeenCalledWith(el);

    observerCallback(
      [
        {
          target: el,
          borderBoxSize: [{ blockSize: 38, inlineSize: 200 }],
          contentRect: { height: 22, width: 180 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );

    expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe(
      "50px",
    );

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe(
      "0px",
    );
  });

  it("falls back to offsetHeight when the entry has no borderBoxSize", () => {
    let observerCallback: ResizeObserverCallback = () => {};

    class MockObserver {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", MockObserver);

    const el = document.createElement("div");
    vi.spyOn(el, "offsetHeight", "get").mockReturnValue(33);
    const ref = { current: el };

    renderHook(() => useMeasuredOffset(ref, true, CSS_VAR));

    observerCallback(
      [
        {
          target: el,
          contentRect: { height: 99, width: 180 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );

    expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe(
      "45px",
    );
  });
});
