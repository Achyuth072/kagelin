"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  className?: string;
  children?: ReactNode;
}

export function CircularProgress({
  value,
  max,
  size = 40,
  strokeWidth = 4,
  color,
  label,
  className,
  children,
}: CircularProgressProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            !color && "stroke-brand",
            !prefersReducedMotion && "transition-seijaku-fast",
          )}
          style={color ? { stroke: color } : undefined}
        />
      </svg>
      {children && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {children}
        </div>
      )}
    </div>
  );
}
