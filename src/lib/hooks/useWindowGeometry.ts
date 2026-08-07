"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import {
  computeWindowGeometry,
  GUTTER_PX,
  INITIAL_WIDTH_GUESS_PX,
} from "@/lib/calendar/week-window";

export function useWindowGeometry(
  containerRef: RefObject<HTMLElement | null>,
  gutterRef: RefObject<HTMLElement | null>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [geometry, setGeometry] = useState(() =>
    computeWindowGeometry(INITIAL_WIDTH_GUESS_PX, GUTTER_PX),
  );

  useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const gutterPx = gutterRef.current?.clientWidth ?? GUTTER_PX;
    setGeometry(computeWindowGeometry(el.clientWidth, gutterPx));
  }, [enabled, containerRef, gutterRef]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const gutterPx = gutterRef.current?.clientWidth ?? GUTTER_PX;
      setGeometry(computeWindowGeometry(entry.contentRect.width, gutterPx));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, containerRef, gutterRef]);

  return geometry;
}
