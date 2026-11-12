/** Canonical Seijaku spring physics for transitions and gestures. */
export const SEIJAKU_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 280,
  damping: 60,
};

/** Seijaku cubic-bezier timing curve and duration for non-spring continuous transitions (e.g. NumberFlow). */
export const SEIJAKU_TIMING = {
  duration: 280,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
};

/** Shared entry animation for full-page views (login, access-denied, error). */
export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: SEIJAKU_SPRING,
};
