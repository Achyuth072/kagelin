"use client";

import { useSyncExternalStore } from "react";
import {
  getTelemetryConsent,
  hasTakenFirstAction,
  setTelemetryConsent as setStoreConsent,
  TELEMETRY_CONSENT_EVENT,
  type TelemetryConsent,
} from "@/lib/telemetry/store";
import { clearTelemetryQueue, trackAppOpened } from "@/lib/telemetry/client";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // store.ts re-dispatches storage events as TELEMETRY_CONSENT_EVENT for cross-tab sync.
  window.addEventListener(TELEMETRY_CONSENT_EVENT, callback);

  return () => {
    window.removeEventListener(TELEMETRY_CONSENT_EVENT, callback);
  };
}

function getSnapshot(): TelemetryConsent {
  return getTelemetryConsent();
}

function getServerSnapshot(): TelemetryConsent {
  return "unprompted";
}

export function useTelemetryConsent() {
  const consent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const firstActionTaken = useSyncExternalStore(
    subscribe,
    hasTakenFirstAction,
    () => false,
  );

  const setConsent = (status: "granted" | "denied") => {
    setStoreConsent(status);
    if (status === "granted") {
      trackAppOpened();
    } else {
      clearTelemetryQueue();
    }
  };

  return {
    consent,
    shouldPrompt: consent === "unprompted" && firstActionTaken,
    setConsent,
  };
}
