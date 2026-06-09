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

function getFullscreenElement(): Element | null {
  const doc = document as DocumentWithVendorPrefixes;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isFullscreenEnabled(): boolean {
  const doc = document as DocumentWithVendorPrefixes;
  return document.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
}

async function requestFullscreenApi(element: Element): Promise<void> {
  const el = element as ElementWithVendorPrefixes;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

async function exitFullscreenApi(): Promise<void> {
  const doc = document as DocumentWithVendorPrefixes;
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
  } else if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

export function useFullscreen() {
  const setIsFullscreen = useUiStore((state) => state.setIsFullscreen);
  const isFullscreen = useUiStore((state) => state.isFullscreen);

  // Sync fullscreenchange events to uiStore (standard + webkit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!getFullscreenElement());
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

    if (isFullscreenEnabled()) {
      try {
        await requestFullscreenApi(document.documentElement);
      } catch {
        // Fullscreen API can throw (e.g., iOS Safari restricts to <video>)
        // or fail silently. Fall through — set isFullscreen true for CSS layout.
      }
    }

    // Set flag for all platforms (mobile uses this for CSS layout fallback)
    setIsFullscreen(true);
  }, [setIsFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (getFullscreenElement()) {
      exitFullscreenApi();
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
