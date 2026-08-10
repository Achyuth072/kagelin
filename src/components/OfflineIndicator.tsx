"use client";

import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsOnline } from "@/lib/hooks/useIsOnline";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const isOnline = useIsOnline();
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Mobile enters from above the header, desktop rises from the bottom of the content column
  const offscreenY = isMobile ? -16 : 16;

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          data-testid="offline-indicator"
          initial={{ y: offscreenY, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: offscreenY, opacity: 0 }}
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
            "fixed inset-x-0 top-[var(--offline-banner-top,var(--mobile-header-height))] z-30",
            "md:absolute md:inset-x-0 md:top-auto md:bottom-6 md:z-40 md:flex md:justify-center md:pointer-events-none",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 bg-card text-foreground border-border/80 pointer-events-auto",
              "h-[var(--offline-banner-height)] w-full justify-center border-b px-4",
              "md:h-auto md:w-auto md:justify-start md:gap-3 md:rounded-lg md:border md:px-4 md:py-2",
            )}
          >
            <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground md:w-8 md:h-8 md:rounded-md md:bg-muted">
              <WifiOff className="w-4 h-4" />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
