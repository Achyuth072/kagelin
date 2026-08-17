"use client";

import { useRef, useState } from "react";
import type { TurnstileHandle } from "@/components/auth/Turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
    siteKey: TURNSTILE_SITE_KEY,
    captchaToken,
    setCaptchaToken,
    turnstileRef,
    handleCaptchaExpire,
    resetCaptcha,
    // Gates submit: blocks while Turnstile is configured but not yet solved.
    captchaMissing: !!TURNSTILE_SITE_KEY && !captchaToken,
  };
}
