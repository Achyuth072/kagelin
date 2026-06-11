"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * True when the primary pointer is coarse (touch). Used to keep ≥44×44 touch
 * targets on touch devices — including the landscape phone and iPad, which are
 * ≥768px wide and so read as non-mobile by width alone.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
