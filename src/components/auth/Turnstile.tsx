"use client";

import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import Script from "next/script";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: TurnstileRenderOptions,
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileHandle {
  reset: () => void;
}

/**
 * Cloudflare Turnstile widget. Hand-rolled instead of pulling in a wrapper
 * package — the API surface we need (render/reset/remove) is tiny and stable.
 * Required once CAPTCHA protection is turned on in the Supabase dashboard:
 * Supabase then rejects `signInWithOtp`/`signUp`/`signInWithPassword` calls
 * that don't carry a fresh token in `options.captchaToken`.
 *
 * `onVerify`/`onExpire` must be stable (wrap in `useCallback` at the call
 * site) — they're mount-effect dependencies, so a new identity every render
 * tears down and re-creates the widget.
 */
export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  handleRef,
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  handleRef?: React.RefObject<TurnstileHandle | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(
    handleRef,
    () => ({
      reset: () => {
        if (widgetIdRef.current) {
          window.turnstile?.reset(widgetIdRef.current);
        }
      },
    }),
    [],
  );

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      "expired-callback": onExpire,
      theme: "auto",
    });
  }, [siteKey, onVerify, onExpire]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  return (
    <>
      <Script
        id="cf-turnstile"
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div className="flex justify-center" ref={containerRef} />
    </>
  );
}
