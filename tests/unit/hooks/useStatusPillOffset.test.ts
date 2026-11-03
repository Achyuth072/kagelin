import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStatusPillOffset } from "@/lib/hooks/useStatusPillOffset";
import { useUiStore } from "@/lib/store/uiStore";

describe("useStatusPillOffset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ isDesktop: true });
    document.documentElement.style.setProperty("--offline-pill-offset", "0px");
  });

  it("sets --offline-pill-offset to 0px when inactive", () => {
    document.documentElement.style.setProperty("--offline-pill-offset", "50px");
    const card = document.createElement("div");
    const ref = { current: card };

    renderHook(() => useStatusPillOffset(ref, false));

    expect(
      document.documentElement.style.getPropertyValue("--offline-pill-offset"),
    ).toBe("0px");
  });

  it("sets --offline-pill-offset to 0px when isDesktop is false", () => {
    document.documentElement.style.setProperty("--offline-pill-offset", "50px");
    useUiStore.setState({ isDesktop: false });
    const card = document.createElement("div");
    const ref = { current: card };

    renderHook(() => useStatusPillOffset(ref, true));

    expect(
      document.documentElement.style.getPropertyValue("--offline-pill-offset"),
    ).toBe("0px");
  });

  it("publishes measured height + 12px when active and on desktop, and resets on unmount", () => {
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

    const card = document.createElement("div");
    const ref = { current: card };

    const { unmount } = renderHook(() => useStatusPillOffset(ref, true));

    expect(mockObserve).toHaveBeenCalledWith(card);

    observerCallback(
      [
        {
          target: card,
          borderBoxSize: [{ blockSize: 38, inlineSize: 200 }],
          contentRect: { height: 22, width: 180 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );

    expect(
      document.documentElement.style.getPropertyValue("--offline-pill-offset"),
    ).toBe("50px");

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(
      document.documentElement.style.getPropertyValue("--offline-pill-offset"),
    ).toBe("0px");
  });
});
