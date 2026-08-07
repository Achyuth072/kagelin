export const GUTTER_PX = 48; // fallback before TimeGutter's rendered width is measured
export const MIN_COL_PX = 104; // narrowest a day column can read at
export const WEEK_LENGTH = 7;
export const EDGE_TOLERANCE_PX = 4;
export const SWIPE_THRESHOLD_PX = 50;
export const ALIGN_TOLERANCE_PX = 1;

export type PageDirection = "next" | "prev";

const MIN_VISIBLE_DAYS = 3;
// Must stay under 7, or it's just desktop's TimeGrid (see CONTEXT.md "Day window").
const MAX_VISIBLE_DAYS = 6;

// Placeholder for the pre-measurement render, not tuned.
export const INITIAL_WIDTH_GUESS_PX = MIN_VISIBLE_DAYS * MIN_COL_PX + GUTTER_PX;

export function computeWindowGeometry(
  containerWidth: number,
  gutterPx = GUTTER_PX,
) {
  const fit = Math.floor((containerWidth - gutterPx) / MIN_COL_PX);
  const visibleDays = Math.min(
    MAX_VISIBLE_DAYS,
    Math.max(MIN_VISIBLE_DAYS, fit),
  );
  const colWidth = (containerWidth - gutterPx) / visibleDays;
  return { visibleDays, colWidth };
}

// Target to realign a rested scroll to, or null if already at a boundary.
export function alignTarget(scrollLeft: number, colWidth: number) {
  if (colWidth <= 0) return null;
  const target = Math.round(scrollLeft / colWidth) * colWidth;
  return Math.abs(target - scrollLeft) <= ALIGN_TOLERANCE_PX ? null : target;
}

export function clampWindowStart(start: number, visibleDays: number) {
  const max = WEEK_LENGTH - visibleDays;
  return Math.max(0, Math.min(start, max));
}

export function edgeAt(
  scrollLeft: number,
  maxScrollLeft: number,
  tolerance: number,
): "start" | "end" | null {
  if (scrollLeft <= tolerance) return "start";
  if (scrollLeft >= maxScrollLeft - tolerance) return "end";
  return null;
}

export function decideSwipeGesture({
  dx,
  dy,
  threshold,
  wasAtStart,
  wasAtEnd,
}: {
  dx: number;
  dy: number;
  threshold: number;
  wasAtStart: boolean;
  wasAtEnd: boolean;
}): PageDirection | null {
  if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < threshold) return null;
  if (dx > 0 && wasAtEnd) return "next";
  if (dx < 0 && wasAtStart) return "prev";
  return null;
}
