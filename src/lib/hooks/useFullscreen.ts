"use client";

import { useCallback, useEffect } from "react";
import { useUiStore } from "@/lib/store/uiStore";

/**
 * Fullscreen Hook
 *
 * Manages fullscreen mode using the Browser Fullscreen API (desktop + Android)
 * and CSS layout mode (iOS fallback). Implements mutual exclusion with PiP per D-09.
 *
 * Desktop/Android: uses document.documentElement.requestFullscreen() / document.exitFullscreen()
 * iOS: gracefully fails API call, falls back to CSS layout via isFullscreen flag
 * Safari: uses webkit vendor prefixes alongside standard API
 */

interface DocumentWithVendorPrefixes extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
}

interface ElementWithVendorPrefixes extends Element {
  webkitRequestFullscreen?: () => Promise<void>;
}

const fsApi = {
  element: () =>
    document.fullscreenElement ??
    (document as DocumentWithVendorPrefixes).webkitFullscreenElement ??
    null,
  enabled: () =>
    document.fullscreenEnabled ??
    (document as DocumentWithVendorPrefixes).webkitFullscreenEnabled ??
    false,
  request: (el: Element) =>
    (
      (el as ElementWithVendorPrefixes).requestFullscreen ??
      (el as ElementWithVendorPrefixes).webkitRequestFullscreen
    )?.call(el),
  exit: () =>
    (
      document.exitFullscreen ??
      (document as DocumentWithVendorPrefixes).webkitExitFullscreen
    )?.call(document),
};

export function useFullscreen() {
  const setIsFullscreen = useUiStore((state) => state.setIsFullscreen);
  const isFullscreen = useUiStore((state) => state.isFullscreen);

  // Sync fullscreenchange events to uiStore (standard + webkit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!fsApi.element());
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [setIsFullscreen]);

  const enterFullscreen = useCallback(async () => {
    // PiP dismissal is handled by PiPProvider's reactive useEffect —
    // no direct setIsPipActive call needed here. The provider detects
    // isFullscreen && isPiPActive and calls closePiP(), which correctly
    // handles both Chrome Document PiP and Firefox popup fallback.

    if (fsApi.enabled()) {
      try {
        await fsApi.request(document.documentElement);
      } catch {
        // Fullscreen API can throw (e.g., iOS Safari restricts to <video>)
        // or fail silently. Fall through — set isFullscreen true for CSS layout.
      }
    }

    // Set flag for all platforms (mobile uses this for CSS layout fallback)
    setIsFullscreen(true);
  }, [setIsFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (fsApi.element()) {
      fsApi.exit();
    }
    setIsFullscreen(false);
    // Do NOT auto-restore PiP per D-09
  }, [setIsFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
