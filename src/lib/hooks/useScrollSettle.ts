import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Detects when a scroller stops: native `scrollend`, else a debounced
// scroll-quiet-gap fallback. `repeat: true` fires on every settle with no
// timeout backstop; the default fires once, backstopped by a timeout.
export function useScrollSettle(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onSettle: () => void,
  {
    settleMs = 150,
    timeoutMs = 800,
    repeat = false,
  }: { settleMs?: number; timeoutMs?: number; repeat?: boolean } = {},
) {
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const oneShot = !repeat;
    let finished = false;
    const finish = () => {
      if (oneShot) {
        if (finished) return;
        finished = true;
      }
      onSettleRef.current();
    };

    const safetyTimer = oneShot ? setTimeout(finish, timeoutMs) : undefined;

    if ("onscrollend" in window) {
      el.addEventListener(
        "scrollend",
        finish,
        oneShot ? { once: true } : undefined,
      );
      return () => {
        el.removeEventListener("scrollend", finish);
        clearTimeout(safetyTimer);
      };
    }

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(finish, settleMs);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(settleTimer);
      clearTimeout(safetyTimer);
    };
  }, [ref, active, settleMs, timeoutMs, repeat]);
}
