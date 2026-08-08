import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useScrollSettle } from "@/lib/hooks/useScrollSettle";

describe("useScrollSettle", () => {
  let el: HTMLDivElement;
  let ref: { current: HTMLDivElement | null };

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
    ref = { current: el };
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
  });

  it("fires onSettle once per scrollend when not repeating (default)", () => {
    const onSettle = vi.fn();
    renderHook(() => useScrollSettle(ref, true, onSettle));

    el.dispatchEvent(new Event("scrollend"));
    expect(onSettle).toHaveBeenCalledTimes(1);

    // once:true means a second scrollend is a no-op for this activation.
    el.dispatchEvent(new Event("scrollend"));
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("falls back to the safety timer when scrollend never fires (non-repeat)", () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    renderHook(() => useScrollSettle(ref, true, onSettle, { timeoutMs: 800 }));

    vi.advanceTimersByTime(800);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("does not fire when inactive", () => {
    const onSettle = vi.fn();
    renderHook(() => useScrollSettle(ref, false, onSettle));

    el.dispatchEvent(new Event("scrollend"));
    expect(onSettle).not.toHaveBeenCalled();
  });

  describe("repeat mode", () => {
    it("fires onSettle on every scrollend, not just the first", () => {
      const onSettle = vi.fn();
      renderHook(() => useScrollSettle(ref, true, onSettle, { repeat: true }));

      el.dispatchEvent(new Event("scrollend"));
      el.dispatchEvent(new Event("scrollend"));
      el.dispatchEvent(new Event("scrollend"));

      expect(onSettle).toHaveBeenCalledTimes(3);
    });

    it("never fires from idle time alone — no unconditional backstop", () => {
      vi.useFakeTimers();
      const onSettle = vi.fn();
      renderHook(() =>
        useScrollSettle(ref, true, onSettle, {
          repeat: true,
          timeoutMs: 800,
        }),
      );

      vi.advanceTimersByTime(5000);
      expect(onSettle).not.toHaveBeenCalled();
    });
  });
});
