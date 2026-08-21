import { cn } from "@/lib/utils";

// Shared by toast actions, DemoBar, and TelemetryConsentPrompt so their flat
// text-link CTAs can't drift out of sync with each other.
// Padding is offset by a negative margin to keep a real tap target without
// shifting the visible text position.
export const NOTIFICATION_LINK_BUTTON_CLASS = cn(
  "font-semibold text-[13px] whitespace-nowrap",
  "underline-offset-2 hover:underline active:opacity-70",
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:rounded-sm",
  "py-1.5 px-1 -my-1.5 -mx-1 shrink-0",
);
