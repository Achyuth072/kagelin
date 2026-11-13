"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

function getSnapshot(): boolean {
  return typeof document !== "undefined" ? !document.hidden : true;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useIsDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
