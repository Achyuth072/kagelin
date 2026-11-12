"use client";

import * as React from "react";
import NumberFlow, { type Trend, type Format } from "@number-flow/react";
import { SEIJAKU_TIMING } from "@/lib/motion";

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
  "data-testid"?: string;
}

function parseNumericValue(raw: string | number): {
  num: number;
  prefix?: string;
  suffix?: string;
} | null {
  if (typeof raw === "number") return { num: raw };
  const trimmed = raw.trim();
  const match = trimmed.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const prefix = match[1] || undefined;
  const num = parseFloat(match[2]);
  const suffix = match[3] || undefined;
  return Number.isNaN(num) ? null : { num, prefix, suffix };
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
  "data-testid": testId,
}: AnimatedNumberProps) {
  const parsed = parseNumericValue(value);

  const [history, setHistory] = React.useState<{
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

  // NumberFlow resets vanished integer digits to 0 (163 -> "016"), so fade them out instantly.
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
      animated={animatedProp ?? true}
      respectMotionPreference
    />
  );
}
