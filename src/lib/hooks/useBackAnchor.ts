"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";
import {
  AUTH_STANDALONE_ROUTES,
  isAdminRoute,
  isOAuthConnectRedirect,
} from "@/lib/auth/auth-routes";

// history.pushState() desyncs App Router's tracking, so use replace()/push().
let anchorSettled: Promise<void> = Promise.resolve();
let resolveAnchorSettled: (() => void) | null = null;

// These routes redirect before "/" ever renders, so skip the bounce.
const UNANCHORED_ROUTES = new Set(AUTH_STANDALONE_ROUTES);

const SETTLE_BACKSTOP_MS = 3000;

// Survives the full document load a failed bounce causes, which a ref cannot.
const PENDING_BOUNCE_KEY = "kanso_back_anchor_pending";

declare global {
  interface Window {
    __backAnchorSettled?: boolean;
  }
}

export function useBackAnchor() {
  const router = useRouter();
  const pathname = usePathname();
  // undefined = unchecked; null = idle/settled; string = pending push target.
  const anchor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const here = pathname + location.search;
    const wasPending = sessionStorage.getItem(PENDING_BOUNCE_KEY) === here;
    if (wasPending) sessionStorage.removeItem(PENDING_BOUNCE_KEY);

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
          // replace("/") is superseded by the push() below and never lands,
          // leaving "?redirect=..." (not "/") beneath the target — so set
          // the URL directly instead.
          window.history.replaceState({}, "", "/");
          router.push(safeRedirect);
          settle();
          return;
        }
      }

      const isOAuthConnect = isOAuthConnectRedirect(pathname, location.search);
      anchor.current =
        pathname === "/" ||
        UNANCHORED_ROUTES.has(pathname) ||
        // Admin pages exit the app on back and link home themselves.
        isAdminRoute(pathname) ||
        isOAuthConnect
          ? null
          : here;
      if (isOAuthConnect && pathname === "/settings") {
        // "connecting" isn't stripped elsewhere — left alone it'd re-suppress the back-anchor on a stale reload.
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
        // A 404 target reloads the document instead of soft-navigating,
        // remounting this hook and re-arming the bounce forever. The marker
        // outlives that reload, so a second attempt stands down instead.
        if (wasPending) {
          anchor.current = null;
          settle();
          return;
        }
        sessionStorage.setItem(PENDING_BOUNCE_KEY, anchor.current);
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
