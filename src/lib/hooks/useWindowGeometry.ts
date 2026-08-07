"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import {
  computeWindowGeometry,
  GUTTER_PX,
  INITIAL_WIDTH_GUESS_PX,
} from "@/lib/calendar/week-window";

// Measures a container and derives {visibleDays, colWidth} via week-window's
// geometry. Shared by MobileWeekGrid and TimeGrid's "auto" day count.
// enabled: false skips measuring entirely — for callers with a fixed count
// that would otherwise pay for a ResizeObserver they never read.
export function useWindowGeometry(
  containerRef: RefObject<HTMLElement | null>,
  gutterRef: RefObject<HTMLElement | null>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  // Overwritten before first paint by the layout effect below.
  const [geometry, setGeometry] = useState(() =>
    computeWindowGeometry(INITIAL_WIDTH_GUESS_PX, GUTTER_PX),
  );

  const measure = (width: number) => {
    const gutterPx = gutterRef.current?.clientWidth ?? GUTTER_PX;
    setGeometry(computeWindowGeometry(width, gutterPx));
  };

  // Runs before paint; ResizeObserver's callback is a frame too late.
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    measure(el.clientWidth);
  }, [enabled]);

  // Resizes after mount (rotation, split-screen, window resize). Its first
  // callback just repeats the measurement above.
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return geometry;
}
