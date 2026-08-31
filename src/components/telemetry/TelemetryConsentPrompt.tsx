"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PrivacyPolicyLink } from "@/components/ui/privacy-policy-link";
import { useTelemetryConsent } from "@/lib/hooks/useTelemetryConsent";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { NOTIFICATION_LINK_BUTTON_CLASS } from "@/components/ui/notification-link-button";

export function TelemetryConsentPrompt() {
  const { consent, setConsent } = useTelemetryConsent();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { trigger } = useHaptic();

  const isVisible = consent === "unprompted";

  // Height feeds --telemetry-prompt-offset (read by Toaster) so toasts don't overlap this banner.
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = bannerRef.current;
    if (!isVisible || !node) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(
        "--telemetry-prompt-offset",
        `${entry.contentRect.height + 12}px`,
      );
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.setProperty("--telemetry-prompt-offset", "0px");
    };
  }, [isVisible]);

  const handleEnable = () => {
    trigger("toggle");
    setConsent("granted");
  };

  const handleDismiss = () => {
    trigger("toggle");
    setConsent("denied");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          role="region"
          aria-label="Telemetry consent"
          data-testid="telemetry-consent-prompt"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  type: "spring",
                  mass: 1,
                  stiffness: 280,
                  damping: 60,
                }
          }
          className={cn(
            // --offline-pill-offset is set on the root by AppShell; it lifts this banner clear of the DemoBar/OfflineIndicator pill, which shares this same bottom-6 anchor on desktop.
            "fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+0.75rem)] md:bottom-[calc(1.5rem+var(--offline-pill-offset,0px))] z-50",
            "flex justify-center px-4 pointer-events-none",
          )}
        >
          <div
            ref={bannerRef}
            className={cn(
              // max-w-md is what mobile actually renders at (the px-4 wrapper
              // already caps it tighter there); md: widens it once there's
              // room, so the copy doesn't wrap to 3 lines on desktop.
              "w-full max-w-md md:max-w-xl p-2.5 sm:p-3 rounded-lg",
              "bg-card text-foreground border border-border/80 shadow-sm",
              "pointer-events-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
              "transition-colors duration-200",
            )}
          >
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
              <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 pr-1 sm:pr-0">
                <p className="text-xs sm:text-sm text-foreground/90 font-normal leading-relaxed">
                  Kagelin is open source &amp; privacy-first. Share anonymous
                  telemetry to help improve the app? See our{" "}
                  <PrivacyPolicyLink />.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="sm:hidden h-7 w-7 -mr-1 -mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                className={cn(
                  NOTIFICATION_LINK_BUTTON_CLASS,
                  "text-muted-foreground",
                )}
              >
                No thanks
              </button>
              <button
                type="button"
                onClick={handleEnable}
                className={cn(NOTIFICATION_LINK_BUTTON_CLASS, "text-brand")}
              >
                Enable
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
