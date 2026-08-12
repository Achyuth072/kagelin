"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";

// history.pushState() desyncs App Router's tracking, so use replace()/push().
// Must run somewhere that survives its own replace() — AppShell, not Template.
let anchorSettled: Promise<void> = Promise.resolve();
let resolveAnchorSettled: (() => void) | null = null;

// /login and /signup's redirect swallows the bounce before "/" ever renders —
// skip them rather than wait out SETTLE_BACKSTOP_MS.
const UNANCHORED_ROUTES = new Set(["/login", "/signup"]);

// Guarantees settle() fires even if a bounce silently stalls.
const SETTLE_BACKSTOP_MS = 3000;

declare global {
  interface Window {
    // Read by e2e/support/guest-mode.ts.
    __backAnchorSettled?: boolean;
  }
}

export function useBackAnchor() {
  const router = useRouter();
  const pathname = usePathname();
  // undefined = unchecked; null = idle/settled; string = pending push target.
  const anchor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (anchor.current === undefined) {
      if (pathname === "/") {
        const searchParams = new URLSearchParams(window.location.search);
        const redirectParam = searchParams.get("redirect");
        const safeRedirect = redirectParam
          ? sanitizeNextPath(redirectParam)
          : null;

        if (safeRedirect && safeRedirect !== "/") {
          anchor.current = null;
          anchorSettled = new Promise((resolve) => {
            resolveAnchorSettled = resolve;
          });
          router.replace("/");
          router.push(safeRedirect);
          settle();
          return;
        }
      }

      anchor.current =
        pathname === "/" || UNANCHORED_ROUTES.has(pathname)
          ? null
          : pathname + location.search;
      if (anchor.current) {
        anchorSettled = new Promise((resolve) => {
          resolveAnchorSettled = resolve;
        });
        router.replace("/");
        const backstop = setTimeout(() => {
          anchor.current = null;
          settle();
        }, SETTLE_BACKSTOP_MS);
        return () => clearTimeout(backstop);
      }
      return;
    }
    if (!anchor.current) return;

    const target = anchor.current;
    anchor.current = null;
    // Landing elsewhere means the user navigated mid-bounce; settle() still fires.
    if (pathname === "/") router.push(target);
    settle();
  }, [pathname, router]);
}

function settle() {
  window.__backAnchorSettled = true;
  resolveAnchorSettled?.();
}

// Avoids firing back() into the replace()/push() gap.
export function useAnchoredBack() {
  const router = useRouter();
  return () => {
    anchorSettled.then(() => router.back());
  };
}
