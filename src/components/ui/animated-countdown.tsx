"use client";

import * as React from "react";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { SEIJAKU_TIMING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface AnimatedCountdownProps {
  seconds: number;
  className?: string;
  "data-testid"?: string;
}

export function AnimatedCountdown({
  seconds,
  className,
  "data-testid": testId,
}: AnimatedCountdownProps) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return (
    <NumberFlowGroup>
      <div
        data-testid={testId}
        className={cn("inline-flex items-baseline tabular-nums", className)}
      >
        <NumberFlow
          value={mins}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          transformTiming={SEIJAKU_TIMING}
          spinTiming={SEIJAKU_TIMING}
          respectMotionPreference
        />
        <span aria-hidden="true">:</span>
        <NumberFlow
          value={secs}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          digits={{ 0: { max: 5 } }}
          transformTiming={SEIJAKU_TIMING}
          spinTiming={SEIJAKU_TIMING}
          respectMotionPreference
        />
      </div>
    </NumberFlowGroup>
  );
}
