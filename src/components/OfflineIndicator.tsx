"use client";

import { useRef } from "react";
import { WifiOff } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useIsOnline } from "@/lib/hooks/useIsOnline";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import {
  BANNER_SLOT_WRAPPER_CLASS,
  BANNER_SLOT_CARD_CLASS,
} from "@/components/bannerSlot";
import { useStatusPillOffset } from "@/lib/hooks/useStatusPillOffset";
import { cn } from "@/lib/utils";
import { SEIJAKU_SPRING } from "@/lib/motion";

export function OfflineIndicator() {
  const isOnline = useIsOnline();
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = !isOnline;

  useStatusPillOffset(cardRef, isVisible);

  // Mobile enters from above the header, desktop rises from the bottom of the content column
  const offscreenY = isMobile ? -16 : 16;

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          data-testid="offline-indicator"
          initial={{ y: offscreenY, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: offscreenY, opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : SEIJAKU_SPRING}
          className={BANNER_SLOT_WRAPPER_CLASS}
        >
          <div
            ref={cardRef}
            className={cn(
              BANNER_SLOT_CARD_CLASS,
              "bg-card text-foreground border-border/80",
            )}
          >
            <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground md:w-8 md:h-8 md:rounded-md md:bg-muted">
              <WifiOff className="w-4 h-4" strokeWidth={2.25} />
            </div>
            <div className="flex items-center gap-1.5 md:flex-col md:items-start md:gap-0 md:leading-tight">
              <span className="text-[13px] font-medium tracking-[0.01em]">
                You are offline
              </span>
              <span
                aria-hidden="true"
                className="text-[11px] text-muted-foreground md:hidden"
              >
                ·
              </span>
              <span className="text-[11px] text-muted-foreground font-normal tracking-[0.02em]">
                Changes will sync when back online
              </span>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
