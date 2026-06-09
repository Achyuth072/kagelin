"use client";

import { useEffect, type RefObject } from "react";

/**
 * Stops wheel/touch events from bubbling to document-level handlers registered
 * by react-remove-scroll (Radix Dialog) and vaul Drawer, which would otherwise
 * kill scroll inside portalled PopoverContent. Pass `enabled` to gate the
 * effect (e.g. tie it to a popover's open state so listeners attach only when
 * the element is in the DOM).
 */
export function useScrollIsolation(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop);
    el.addEventListener("touchmove", stop);
    el.addEventListener("touchstart", stop);
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("touchstart", stop);
    };
  }, [ref, enabled]);
}
