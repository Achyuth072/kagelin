"use client";

import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
