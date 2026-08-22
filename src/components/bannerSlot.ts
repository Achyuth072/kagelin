// The layout shared by OfflineIndicator and DemoBar: a full-width strip
// pinned under the mobile header, becoming a centered pill on desktop. The
// two never show at once (see AppShell's `hasTopBanner`), so they share one
// footprint — only the color and content differ per state.
export const BANNER_SLOT_WRAPPER_CLASS =
  "fixed inset-x-0 top-[var(--offline-banner-top,var(--mobile-header-height))] z-30 md:absolute md:inset-x-0 md:top-auto md:bottom-6 md:z-40 md:flex md:justify-center md:pointer-events-none";

export const BANNER_SLOT_CARD_CLASS =
  "flex items-center gap-2 pointer-events-auto h-[var(--offline-banner-height)] w-full justify-center border-b px-4 md:h-auto md:w-auto md:justify-start md:gap-3 md:rounded-lg md:border md:px-4 md:py-2";
