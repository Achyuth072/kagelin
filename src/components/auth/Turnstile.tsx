"use client";

import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import Script from "next/script";
import { useTheme } from "next-themes";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
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
  // resolvedTheme (not the OS-level "auto") so the widget matches the app's
  // own light/dark toggle, not just system preference — Turnstile's built-in
  // "auto" only tracks prefers-color-scheme and would desync whenever the
  // user overrides the theme manually.
  const { resolvedTheme } = useTheme();

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
      theme: resolvedTheme === "dark" ? "dark" : "light",
      // Stretches to the width of the email input/button above and below it
      // instead of floating as a fixed-width island — matches the ink & matte
      // system's flush, structural alignment over centered decorative blocks.
      size: "flexible",
    });
  }, [siteKey, onVerify, onExpire, resolvedTheme]);

  // `renderWidget` picks up a new identity whenever `resolvedTheme` changes,
  // so this effect's cleanup (remove) + re-run (render) also doubles as the
  // theme-change handler — Turnstile has no way to update an existing
  // widget's theme in place.
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
      <div ref={containerRef} />
    </>
  );
}
