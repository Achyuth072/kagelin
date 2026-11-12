"use client";

import * as m from "motion/react-m";

// No `y` transform — it'd break position:fixed/absolute descendants (e.g. the focus page's PiP button).
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.15,
};

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </m.div>
  );
}
