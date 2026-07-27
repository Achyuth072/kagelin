import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Detects when a scroller stops: native `scrollend`, else a debounced
// scroll-quiet-gap fallback, with a timeout backstop.
export function useScrollSettle(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onSettle: () => void,
  {
    settleMs = 150,
    timeoutMs = 800,
  }: { settleMs?: number; timeoutMs?: number } = {},
) {
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onSettleRef.current();
    };

    const safetyTimer = setTimeout(finish, timeoutMs);

    if ("onscrollend" in window) {
      el.addEventListener("scrollend", finish, { once: true });
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
  }, [ref, active, settleMs, timeoutMs]);
}
