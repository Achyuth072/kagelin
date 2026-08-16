"use client";

import { useRef, useState } from "react";
import { isPasswordBreached } from "@/lib/auth/password-breach-check";

// Checks on blur, not keystroke, so the HIBP prefix doesn't narrow with every
// character typed. Dedupes on the last-checked password and guards against a
// stale response overwriting a newer check's result.
export function usePasswordBreachCheck() {
  const [breached, setBreached] = useState(false);
  const lastCheckedRef = useRef<string | null>(null);

  const checkOnBlur = (password: string, skip: boolean) => {
    if (skip || password.length === 0) return;
    if (lastCheckedRef.current === password) return;
    lastCheckedRef.current = password;

    isPasswordBreached(password)
      .then((result) => {
        if (lastCheckedRef.current === password) setBreached(result);
      })
      .catch(() => {
        if (lastCheckedRef.current === password) setBreached(false);
      });
  };

  const clearBreach = () => setBreached(false);

  return { breached, checkOnBlur, clearBreach };
}
