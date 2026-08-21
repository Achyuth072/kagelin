"use client";

import { useSyncExternalStore } from "react";
import {
  getTelemetryConsent,
  setTelemetryConsent as setStoreConsent,
  TELEMETRY_CONSENT_EVENT,
  type TelemetryConsent,
} from "@/lib/telemetry/store";
import { clearTelemetryQueue, trackAppOpened } from "@/lib/telemetry/client";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // store.ts's own "storage" listener re-dispatches this event for cross-tab
  // changes too, so it's the only signal this hook needs to listen for.
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
    setConsent,
  };
}
