"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { SEIJAKU_TIMING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useIsDocumentVisible } from "@/lib/hooks/useIsDocumentVisible";

export interface AnimatedCountdownProps {
  seconds: number;
  className?: string;
  willChange?: boolean;
  animated?: boolean;
  "data-testid"?: string;
}

export function AnimatedCountdown({
  seconds,
  className,
  willChange = true,
  animated: animatedProp,
  "data-testid": testId,
}: AnimatedCountdownProps) {
  const isVisible = useIsDocumentVisible();
  const animated = animatedProp ?? isVisible;

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
          willChange={willChange}
          animated={animated}
          respectMotionPreference
        />
        <span aria-hidden="true">:</span>
        <NumberFlow
          value={secs}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          digits={{ 1: { max: 5 } }}
          transformTiming={SEIJAKU_TIMING}
          spinTiming={SEIJAKU_TIMING}
          willChange={willChange}
          animated={animated}
          respectMotionPreference
        />
      </div>
    </NumberFlowGroup>
  );
}
