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
  trend,
  prefix: prefixProp,
  suffix: suffixProp,
  duration,
  className,
  isolate = true,
  "data-testid": testId,
}: AnimatedNumberProps) {
  const parsed = parseNumericValue(value);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  const timing = duration
    ? { duration, easing: SEIJAKU_TIMING.easing }
    : SEIJAKU_TIMING;

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
      isolate={isolate}
      respectMotionPreference
    />
  );
}
