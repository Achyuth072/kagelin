/** Shared entry animation for full-page views (login, access-denied, error). */
export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    type: "spring" as const,
    mass: 1,
    stiffness: 280,
    damping: 60,
  },
};
