"use client";

import { useState } from "react";
import NumberFlow, { type Trend, type Format } from "@number-flow/react";
import { SEIJAKU_TIMING } from "@/lib/motion";
import { useIsDocumentVisible } from "@/lib/hooks/useIsDocumentVisible";

export interface AnimatedNumberProps {
  value: number | string;
  format?: Format;
  trend?: Trend;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  isolate?: boolean;
  animated?: boolean;
  willChange?: boolean;
  "data-testid"?: string;
}

function parseNumericValue(raw: string | number): {
  num: number;
  prefix?: string;
  suffix?: string;
} | null {
  if (typeof raw === "number") return { num: raw };
  const match = raw.trim().match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2]);
  return Number.isNaN(num)
    ? null
    : { num, prefix: match[1] || undefined, suffix: match[3] || undefined };
}

export function AnimatedNumber({
  value,
  format,
  trend = 0,
  prefix: prefixProp,
  suffix: suffixProp,
  duration,
  className,
  isolate = true,
  animated: animatedProp,
  willChange,
  "data-testid": testId,
}: AnimatedNumberProps) {
  const isVisible = useIsDocumentVisible();
  const animated = animatedProp ?? isVisible;
  const parsed = parseNumericValue(value);

  const [history, setHistory] = useState<{
    prevNum: number | null;
    currentNum: number | null;
  }>(() => ({
    prevNum: null,
    currentNum: parsed?.num ?? null,
  }));

  if (parsed && parsed.num !== history.currentNum) {
    setHistory({
      prevNum: history.currentNum,
      currentNum: parsed.num,
    });
  }

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  const currentIntLength = Math.abs(Math.trunc(parsed.num)).toString().length;
  const prevIntLength =
    history.prevNum !== null
      ? Math.abs(Math.trunc(history.prevNum)).toString().length
      : currentIntLength;

  const timing = duration
    ? { duration, easing: SEIJAKU_TIMING.easing }
    : SEIJAKU_TIMING;

  const opacityTiming =
    history.prevNum !== null && currentIntLength < prevIntLength
      ? { duration: 0 }
      : timing;

  return (
    <NumberFlow
      data-testid={testId}
      value={parsed.num}
      prefix={prefixProp ?? parsed.prefix}
      suffix={suffixProp ?? parsed.suffix}
      format={format}
      trend={trend}
      className={className}
      transformTiming={timing}
      spinTiming={timing}
      opacityTiming={opacityTiming}
      isolate={isolate}
      animated={animated}
      willChange={willChange}
      respectMotionPreference
    />
  );
}
