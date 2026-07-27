import { format } from "date-fns";

export const HOUR_HEIGHT = 120; // px per hour row
export const HEADER_HEIGHT = 80; // day-column header row, matches h-20
export const hours = Array.from({ length: 24 }).map((_, i) => i);
export const HOUR_LABELS = hours.map((hour) =>
  format(new Date().setHours(hour, 0, 0, 0), "h a"),
);

/** scrollTop that centers the current-time indicator in a viewport of this height. */
export function scrollTopForNow(clientHeight: number): number {
  const now = new Date();
  const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const indicatorTop = (minutesFromMidnight / 60) * HOUR_HEIGHT + HEADER_HEIGHT;
  return Math.max(0, indicatorTop - clientHeight / 2);
}
