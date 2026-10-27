"use client";

import { useEffect } from "react";
import { useUiStore } from "@/lib/store/uiStore";

export function useStatusPillOffset(
  cardRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  const isDesktop = useUiStore((state) => state.isDesktop);

  useEffect(() => {
    const root = document.documentElement;
    const node = cardRef.current;

    if (!isActive || !isDesktop || !node) {
      root.style.setProperty("--offline-pill-offset", "0px");
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        (entry.target as HTMLElement).offsetHeight ??
        entry.contentRect.height;
      root.style.setProperty("--offline-pill-offset", `${height + 12}px`);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      root.style.setProperty("--offline-pill-offset", "0px");
    };
  }, [isActive, isDesktop, cardRef]);
}
