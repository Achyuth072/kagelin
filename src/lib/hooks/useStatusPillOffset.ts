"use client";

import { useUiStore } from "@/lib/store/uiStore";
import { useMeasuredOffset } from "@/lib/hooks/useMeasuredOffset";

// Desktop-only: on mobile the status banner is a top strip under the header
// (z-status) and nothing anchors to its bottom edge.
export function useStatusPillOffset(
  cardRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  const isDesktop = useUiStore((state) => state.isDesktop);

  useMeasuredOffset(cardRef, isActive && isDesktop, "--offline-pill-offset");
}
