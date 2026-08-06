"use client";

import { useRouter } from "next/navigation";

// True once a second page has been seen in this window — resets on a fresh
// page load, e.g. clients.openWindow() from a notificationclick (app/sw.ts).
let mounted = false;
let hasInAppHistory = false;

export function recordNavigation() {
  if (mounted) hasInAppHistory = true;
  mounted = true;
}

// router.back() with nothing behind it is a no-op (stuck) or, on Android
// standalone/TWA, exits the PWA.
export function useSmartBack() {
  const router = useRouter();

  return () => {
    if (hasInAppHistory) {
      router.back();
    } else {
      router.push("/");
    }
  };
}
