"use client";

import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";

export function AuthCaptcha({
  siteKey,
  setCaptchaToken,
  handleCaptchaExpire,
  turnstileRef,
}: {
  siteKey: string | undefined;
  setCaptchaToken: (token: string) => void;
  handleCaptchaExpire: () => void;
  turnstileRef: React.RefObject<TurnstileHandle | null>;
}) {
  if (!siteKey) return null;

  return (
    <Turnstile
      siteKey={siteKey}
      onVerify={setCaptchaToken}
      onExpire={handleCaptchaExpire}
      handleRef={turnstileRef}
    />
  );
}
