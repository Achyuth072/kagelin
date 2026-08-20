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

  window.addEventListener(TELEMETRY_CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(TELEMETRY_CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
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
