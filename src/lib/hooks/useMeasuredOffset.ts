"use client";

import { useEffect } from "react";

// Lift gap between the measured element and whatever stacks above it.
const LIFT_GAP_PX = 12;

/**
 * Publishes the measured border-box height of `ref`'s node as a root custom
 * property and resets it to `0px` when hidden or unmounted. Shared by
 * TelemetryConsentPrompt, the status pill (useStatusPillOffset) and
 * FloatingTimer so their stacking formulas stay consistent.
 *
 * `active` must flip whenever any gating condition changes (visibility,
 * breakpoints), since it is the effect's only re-run trigger.
 */
export function useMeasuredOffset(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  cssVar: string,
) {
  useEffect(() => {
    const root = document.documentElement;
    const node = ref.current;

    if (!active || !node) {
      root.style.setProperty(cssVar, "0px");
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      // borderBoxSize includes padding/border; offsetHeight is the fallback.
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        (entry.target as HTMLElement).offsetHeight;
      root.style.setProperty(cssVar, `${height + LIFT_GAP_PX}px`);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      root.style.setProperty(cssVar, "0px");
    };
  }, [active, ref, cssVar]);
}
