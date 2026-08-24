"use client";

import { useIsOnline } from "@/lib/hooks/useIsOnline";
import { useDemoMode } from "@/lib/hooks/useDemoMode";

// Shared by OfflineIndicator and DemoBar, which never show at once — one
// footprint for both, only color and content differ.
export const BANNER_SLOT_WRAPPER_CLASS =
  "fixed inset-x-0 top-[var(--offline-banner-top,var(--mobile-header-height))] z-30 md:absolute md:inset-x-0 md:top-auto md:bottom-6 md:z-40 md:flex md:justify-center md:pointer-events-none";

export const BANNER_SLOT_CARD_CLASS =
  "flex items-center gap-2 pointer-events-auto h-[var(--offline-banner-height)] w-full justify-center border-b px-4 md:h-auto md:w-auto md:justify-start md:gap-3 md:rounded-lg md:border md:px-4 md:py-2";

export type BannerSlotContent = "offline" | "demo" | null;

// Centralized so AppShell and DemoBar can't drift on the priority order.
export function useActiveBanner(): BannerSlotContent {
  const isOnline = useIsOnline();
  const isDemoMode = useDemoMode();

  if (!isOnline) return "offline";
  if (isDemoMode) return "demo";
  return null;
}
