import type { CSSProperties } from "react";

export interface CalendarEventChipOptions {
  color?: string | null;
  isTask?: boolean;
  borderLeftWidth?: 3 | 4;
}

/**
 * Builds opaque matte styles for calendar event chips adhering to the Kagelin Design System.
 * Uses Tailwind v4's resolved CSS variables (var(--color-card), var(--color-brand)) inside color-mix().
 */
export function getCalendarEventChipStyle({
  color,
  isTask = false,
  borderLeftWidth = 3,
}: CalendarEventChipOptions): CSSProperties {
  const accent = color || "var(--color-brand)";
  const mixPercentage = isTask ? "7%" : "16%";
  return {
    backgroundColor: `color-mix(in srgb, ${accent} ${mixPercentage}, var(--color-card))`,
    borderLeftColor: accent,
    borderLeftWidth: `${borderLeftWidth}px`,
  };
}
