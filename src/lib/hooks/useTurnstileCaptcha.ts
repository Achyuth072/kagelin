"use client";

import { useRef, useState } from "react";
import type { TurnstileHandle } from "@/components/auth/Turnstile";

export function useTurnstileCaptcha() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const handleCaptchaExpire = () => setCaptchaToken(null);

  // Turnstile tokens are single-use — call after every submit attempt,
  // regardless of outcome, so the next attempt gets a fresh one.
  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  return {
    captchaToken,
    setCaptchaToken,
    turnstileRef,
    handleCaptchaExpire,
    resetCaptcha,
  };
}
