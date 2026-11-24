export const SEIJAKU_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 280,
  damping: 60,
};

// Critically damped with multi-frame interpolation so short mobile pill travels do not snap instantly.
export const SEIJAKU_SPRING_FAST = {
  type: "spring",
  mass: 1,
  stiffness: 400,
  damping: 38,
} as const;

export const SEIJAKU_TIMING = {
  duration: 280,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: SEIJAKU_SPRING,
};
