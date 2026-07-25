export const GUTTER_PX = 48; // fallback before TimeGutter's rendered width is measured
export const MIN_COL_PX = 104; // narrowest a day column can read at
export const WEEK_LENGTH = 7;
export const EDGE_TOLERANCE_PX = 4;
export const SWIPE_THRESHOLD_PX = 50;

const MIN_VISIBLE_DAYS = 3;
// Must stay under 7, or it's just desktop's TimeGrid (see CONTEXT.md "Day window").
const MAX_VISIBLE_DAYS = 6;

// Pre-measurement geometry guess: the window's own minimum footprint.
export const INITIAL_WIDTH_GUESS_PX = MIN_VISIBLE_DAYS * MIN_COL_PX + GUTTER_PX;

/** How many of the week's 7 days fit on screen, and how wide each is. */
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

/** Clamps a day-window start index so the window never runs past the week. */
export function clampWindowStart(start: number, visibleDays: number) {
  const max = WEEK_LENGTH - visibleDays;
  return Math.max(0, Math.min(start, max));
}

/** Reads which edge of the day window a scroller is parked at, if any. */
export function edgeAt(
  scrollLeft: number,
  maxScrollLeft: number,
  tolerance: number,
): "start" | "end" | null {
  if (scrollLeft <= tolerance) return "start";
  if (scrollLeft >= maxScrollLeft - tolerance) return "end";
  return null;
}

/** Whether a completed swipe should page the week — only if it started parked at that edge. */
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
}): "next" | "prev" | null {
  if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < threshold) return null;
  if (dx > 0 && wasAtEnd) return "next";
  if (dx < 0 && wasAtStart) return "prev";
  return null;
}
