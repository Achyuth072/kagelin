import { supportsInstallPrompt } from "@/lib/utils/platform";

const DISMISSED_KEY = "pwaInstallHintDismissed";
const OPEN_COUNT_KEY = "pwaInstallOpenCount";

// Neither platform has a native engagement signal, so a session counter is
// the one thing that behaves identically on Android and iOS.
export const OPEN_COUNT_THRESHOLD = 3;

export function isInstallHintDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISSED_KEY) === "true";
}

export function dismissInstallHint(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, "true");
}

// Returns the count *after* incrementing, so callers can gate on the
// threshold without a separate read.
export function recordAppOpen(): number {
  if (typeof window === "undefined") return 0;
  const current = Number(localStorage.getItem(OPEN_COUNT_KEY) ?? "0");
  const next = current + 1;
  localStorage.setItem(OPEN_COUNT_KEY, String(next));
  return next;
}

export function hasReachedOpenThreshold(): boolean {
  if (typeof window === "undefined") return false;
  return (
    Number(localStorage.getItem(OPEN_COUNT_KEY) ?? "0") >= OPEN_COUNT_THRESHOLD
  );
}

export interface InstallBannerEligibility {
  isInstalled: boolean;
  isMobile: boolean;
  isIOS: boolean;
  canInstall: boolean;
  dismissed: boolean;
  openThresholdReached: boolean;
}

// Android additionally needs a captured `beforeinstallprompt` event; iOS has
// no such signal and is eligible as soon as the shared checks pass.
export function shouldShowInstallBanner({
  isInstalled,
  isMobile,
  isIOS,
  canInstall,
  dismissed,
  openThresholdReached,
}: InstallBannerEligibility): boolean {
  if (isInstalled || !isMobile || dismissed || !openThresholdReached) {
    return false;
  }
  return isIOS || canInstall;
}

export interface InstallRowEligibility {
  isInstalled: boolean;
  isMobile: boolean;
  isIOS: boolean;
  canInstall: boolean;
}

// Android/iOS are always installable somehow (their own browser menu or the
// Share sheet), even without a captured event — but on desktop, Firefox and
// Safari have no install path at all, so there's nothing honest to offer.
export function shouldShowInstallRow({
  isInstalled,
  isMobile,
  isIOS,
  canInstall,
}: InstallRowEligibility): boolean {
  if (isInstalled) return false;
  return isMobile || isIOS || canInstall || supportsInstallPrompt();
}
