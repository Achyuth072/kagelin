"use client";

import * as React from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { SEIJAKU_SPRING } from "@/lib/motion";

const loadDomMax = () => import("motion/react").then((mod) => mod.domMax);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SEIJAKU_SPRING}>
      <LazyMotion features={loadDomMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
