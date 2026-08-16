"use client";

import { useEffect, useState } from "react";
import { isIOS as detectIOS, isStandalone } from "@/lib/utils/platform";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import {
  isInstallHintDismissed,
  dismissInstallHint,
  recordAppOpen,
  hasReachedOpenThreshold,
  shouldShowInstallBanner,
  shouldShowInstallRow,
  OPEN_COUNT_THRESHOLD,
} from "@/lib/utils/pwaInstall";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

// Module-level, not per-hook state: multiple components mount this hook
// (Home banner, Settings row), but the open should only be recorded once.
let hasRecordedOpenThisLoad = false;
function recordOpenOnce(): boolean {
  if (!hasRecordedOpenThisLoad) {
    hasRecordedOpenThisLoad = true;
    return recordAppOpen() >= OPEN_COUNT_THRESHOLD;
  }
  return hasReachedOpenThreshold();
}

export function usePwaInstall() {
  const isMobile = useIsMobile();
  const isIOS = detectIOS();
  const [isInstalled, setIsInstalled] = useState(() => isStandalone());
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => isInstallHintDismissed());
  const [openThresholdReached] = useState(() => recordOpenOnce());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  useEffect(() => {
    const handleAppInstalled = () => setIsInstalled(true);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  const canInstall = deferredEvent !== null;

  const shouldShowBanner = shouldShowInstallBanner({
    isInstalled,
    isMobile,
    isIOS,
    canInstall,
    dismissed,
    openThresholdReached,
  });

  const shouldShowRow = shouldShowInstallRow({
    isInstalled,
    isMobile,
    isIOS,
    canInstall,
  });

  const promptInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    // A deferred event can only be prompted once — spent either way.
    setDeferredEvent(null);
    if (outcome === "accepted") {
      setIsInstalled(true);
    } else {
      dismissInstallHint();
      setDismissed(true);
    }
  };

  const dismiss = () => {
    dismissInstallHint();
    setDismissed(true);
  };

  return {
    canInstall,
    promptInstall,
    isInstalled,
    isIOS,
    shouldShowBanner,
    shouldShowRow,
    dismiss,
  };
}
