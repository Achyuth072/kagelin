import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useWindowGeometry } from "@/lib/hooks/useWindowGeometry";
import {
  computeWindowGeometry,
  GUTTER_PX,
  INITIAL_WIDTH_GUESS_PX,
} from "@/lib/calendar/week-window";

let resizeObserverCallback: ResizeObserverCallback | null = null;

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
}

function elementWithWidth(width: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    get: () => width,
  });
  document.body.appendChild(el);
  return el;
}

const noGutter = { current: null };

describe("useWindowGeometry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resizeObserverCallback = null;
  });

  it("measures the container before first paint", () => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const container = elementWithWidth(600);
    const ref = { current: container };

    const { result } = renderHook(() => useWindowGeometry(ref, noGutter));

    expect(result.current.visibleDays).toBe(5);
  });

  it("reads the gutter's measured width instead of the fallback", () => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const container = elementWithWidth(600);
    const gutter = elementWithWidth(64);
    const ref = { current: container };
    const gutterRef = { current: gutter };

    const withGutterRef = renderHook(() => useWindowGeometry(ref, gutterRef));
    const withoutGutterRef = renderHook(() => useWindowGeometry(ref, noGutter));

    expect(withGutterRef.result.current.colWidth).toBeLessThan(
      withoutGutterRef.result.current.colWidth,
    );
  });

  it("re-measures on resize", () => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const container = elementWithWidth(360);
    const ref = { current: container };

    const { result } = renderHook(() => useWindowGeometry(ref, noGutter));
    expect(result.current.visibleDays).toBe(3);

    act(() => {
      resizeObserverCallback?.(
        [{ contentRect: { width: 767 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(result.current.visibleDays).toBe(6);
  });

  it("falls back to GUTTER_PX before a container is available", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useWindowGeometry(ref, noGutter));
    expect(result.current.colWidth).toBeGreaterThan(0);
    expect(GUTTER_PX).toBe(48);
  });

  it("never measures or observes when disabled", () => {
    const observe = vi.fn();
    class SpyResizeObserver {
      observe = observe;
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(_callback: ResizeObserverCallback) {}
    }
    vi.stubGlobal("ResizeObserver", SpyResizeObserver);
    const container = elementWithWidth(600);
    const ref = { current: container };

    const { result } = renderHook(() =>
      useWindowGeometry(ref, noGutter, { enabled: false }),
    );

    expect(result.current).toEqual(
      computeWindowGeometry(INITIAL_WIDTH_GUESS_PX, GUTTER_PX),
    );
    expect(observe).not.toHaveBeenCalled();
  });
});
