"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";
import {
  AUTH_STANDALONE_ROUTES,
  isOAuthConnectRedirect,
} from "@/lib/auth/authRoutes";

// history.pushState() desyncs App Router's tracking, so use replace()/push().
// Must run somewhere that survives its own replace() — AppShell, not Template.
let anchorSettled: Promise<void> = Promise.resolve();
let resolveAnchorSettled: (() => void) | null = null;

// These routes' own redirect swallows the bounce before "/" ever renders —
// skip them rather than wait out SETTLE_BACKSTOP_MS.
const UNANCHORED_ROUTES = new Set(AUTH_STANDALONE_ROUTES);

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

      const isOAuthConnect = isOAuthConnectRedirect(pathname, location.search);
      anchor.current =
        pathname === "/" || UNANCHORED_ROUTES.has(pathname) || isOAuthConnect
          ? null
          : pathname + location.search;
      if (isOAuthConnect && pathname === "/settings") {
        // /calendar's landing params (connected/oauth_error) are already
        // stripped by their own owning components; /settings' "connecting"
        // isn't stripped anywhere else — leaving it would re-suppress the
        // back-anchor on a later hard reload of the stale URL.
        const params = new URLSearchParams(location.search);
        params.delete("connecting");
        const cleaned = params.toString();
        window.history.replaceState(
          {},
          "",
          pathname + (cleaned ? `?${cleaned}` : ""),
        );
      }
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
