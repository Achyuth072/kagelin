"use client";

import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PrivacyPolicyLink } from "@/components/ui/privacy-policy-link";
import { useTelemetryConsent } from "@/lib/hooks/useTelemetryConsent";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

export function TelemetryConsentPrompt() {
  const { consent, setConsent } = useTelemetryConsent();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { trigger } = useHaptic();

  const isVisible = consent === "unprompted";

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
            "fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom,0px)+12px)] md:bottom-6 z-50",
            "flex justify-center px-4 pointer-events-none",
          )}
        >
          <div
            className={cn(
              "w-full max-w-lg p-3.5 sm:p-4 rounded-lg",
              "bg-card text-foreground border border-border/80 shadow-sm",
              "pointer-events-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
              "transition-colors duration-200",
            )}
          >
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 p-2 rounded-md bg-secondary/30 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
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

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismiss}
                className="h-8 px-3 text-xs font-medium"
              >
                No thanks
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEnable}
                className="h-8 px-3.5 text-xs bg-brand hover:bg-brand/90 text-brand-foreground font-medium shadow-none transition-seijaku-fast"
              >
                Enable
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
