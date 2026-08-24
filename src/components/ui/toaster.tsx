"use client";

import { Toaster as SonnerToaster } from "sonner";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import { NOTIFICATION_LINK_BUTTON_CLASS } from "@/components/ui/notification-link-button";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function Toaster() {
  const isChangelogOpen = useUiStore((state) => state.isChangelogOpen);
  return (
    <SonnerToaster
      position="bottom-center"
      expand={true}
      duration={isChangelogOpen ? Infinity : 4000}
      style={{ zIndex: 70 }}
      // Container-level offset (not a per-toast margin) so it shifts the whole
      // stack as one unit — Sonner measures each toast's own height to place
      // the next one above it, and a per-toast margin isn't part of that
      // measurement, which caused stacked toasts to overlap.
      // --offline-pill-offset is set on the root by AppShell; it lifts desktop toasts clear of the centred offline pill.
      // --telemetry-prompt-offset is set on the root by TelemetryConsentPrompt; it lifts toasts clear of that banner.
      offset={{
        bottom:
          "calc(1.25rem + var(--offline-pill-offset,0px) + var(--telemetry-prompt-offset,0px))",
      }}
      mobileOffset={{
        left: 16,
        right: 16,
        bottom:
          "calc(72px + env(safe-area-inset-bottom,0px) + var(--telemetry-prompt-offset,0px))",
      }}
      swipeDirections={["left", "right", "bottom"]}
      toastOptions={{
        unstyled: true,
        style: {
          // max-content (not fit-content): fit-content shrinks to min-content (longest word) inside Sonner's absolute-positioned <li>, causing mid-word wrap on short messages. max-content sizes to the natural one-line width; existing maxWidth caps long messages.
          // The rem side of this min() only binds once the viewport is wide enough to clear it (mobile stays governed by the vw side, unchanged) — so raising it only gives long toasts (e.g. the backup reminder) more room on desktop, without affecting short ones or mobile.
          width: "max-content",
          maxWidth: "min(34rem, calc(100vw - 2rem))",
        },
        classNames: {
          toast: cn(
            inter.variable,
            "font-sans",
            "bg-card/98 backdrop-blur-md border border-border/80 text-foreground",
            "rounded-md shadow-sm inline-flex items-center gap-3",
            "py-2.5 px-4 sm:py-3 sm:px-5",
            "w-fit",
            "transition-all duration-300 ease-seijaku",
            "[&_[data-icon]]:text-foreground/60",
          ),
          icon: "shrink-0 [&>svg]:w-5 [&>svg]:h-5",
          content: "min-w-0 flex-1",
          title:
            "font-semibold text-[13px] sm:text-sm tracking-tight leading-tight",
          description:
            "text-[12px] sm:text-sm text-muted-foreground leading-normal",
          error: cn("[&_[data-icon]]:text-destructive"),
          actionButton: cn(
            NOTIFICATION_LINK_BUTTON_CLASS,
            "text-brand ml-auto sm:ml-0",
          ),
          cancelButton: cn(
            NOTIFICATION_LINK_BUTTON_CLASS,
            "text-muted-foreground ml-auto sm:ml-0",
          ),
        },
      }}
    />
  );
}
