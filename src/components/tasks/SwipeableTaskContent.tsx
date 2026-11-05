import React, { useEffect, useRef } from "react";
import {
  animate,
  motion,
  PanInfo,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableTaskContentProps {
  children: React.ReactNode;
  isDesktop: boolean;
  _isDragging: boolean;
  _isHandleActive: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  className?: string;
  onClick?: () => void;
  suspended?: boolean;
  isCompleted?: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  shouldShowHint?: boolean;
  onHintShown?: () => void;
}

const SWIPE_THRESHOLD = 75;
const SWIPE_VELOCITY_THRESHOLD = 350;
const SWIPE_MIN_OFFSET_FOR_VELOCITY = 30;

export function SwipeableTaskContent({
  children,
  isDesktop,
  _isDragging,
  _isHandleActive,
  onSwipeLeft,
  onSwipeRight,
  onSwipeStart,
  onSwipeEnd,
  className,
  onClick,
  suspended = false,
  isCompleted = false,
  triggerHaptic,
  shouldShowHint = false,
  onHintShown,
}: SwipeableTaskContentProps) {
  const x = useMotionValue(0);
  const hasHapticFiredRef = useRef(false);

  const completeBgOpacity = useTransform(
    x,
    [0, 15, SWIPE_THRESHOLD],
    [0, 0.4, 1],
    { clamp: true },
  );
  const deleteBgOpacity = useTransform(
    x,
    [-SWIPE_THRESHOLD, -15, 0],
    [1, 0.4, 0],
    { clamp: true },
  );

  const leftIconOpacity = useTransform(x, [0, 15], [0, 1], { clamp: true });
  const rightIconOpacity = useTransform(x, [-15, 0], [1, 0], { clamp: true });

  const leftIconScale = useTransform(
    x,
    [0, SWIPE_THRESHOLD - 15, SWIPE_THRESHOLD],
    [0.85, 1, 1.15],
    { clamp: true },
  );
  const rightIconScale = useTransform(
    x,
    [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD + 15, 0],
    [1.15, 1, 0.85],
    { clamp: true },
  );

  useMotionValueEvent(x, "change", (latestX) => {
    if (isCompleted) return;
    const absX = Math.abs(latestX);
    if (absX >= SWIPE_THRESHOLD && !hasHapticFiredRef.current) {
      hasHapticFiredRef.current = true;
      triggerHaptic?.("tick");
    } else if (absX < SWIPE_THRESHOLD - 20) {
      hasHapticFiredRef.current = false;
    }
  });

  useEffect(() => {
    if (!shouldShowHint || isDesktop || isCompleted) return;

    const timer = setTimeout(() => {
      animate(x, [0, 32, 0, -32, 0], {
        duration: 0.9,
        times: [0, 0.25, 0.5, 0.75, 1],
        ease: "easeInOut",
        onComplete: onHintShown,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [shouldShowHint, isDesktop, isCompleted, x, onHintShown]);

  const handleDragStart = () => {
    hasHapticFiredRef.current = false;
    onSwipeStart?.();
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    hasHapticFiredRef.current = false;
    onSwipeEnd?.();
    if (isCompleted) return;

    const isLeftTriggered =
      info.offset.x < -SWIPE_THRESHOLD ||
      (info.offset.x < -SWIPE_MIN_OFFSET_FOR_VELOCITY &&
        info.velocity.x < -SWIPE_VELOCITY_THRESHOLD);

    const isRightTriggered =
      info.offset.x > SWIPE_THRESHOLD ||
      (info.offset.x > SWIPE_MIN_OFFSET_FOR_VELOCITY &&
        info.velocity.x > SWIPE_VELOCITY_THRESHOLD);

    if (isLeftTriggered || isRightTriggered) {
      (document.activeElement as HTMLElement)?.blur();
      if (isLeftTriggered) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }
  };

  if (suspended) {
    return (
      <div className={cn("relative", className)} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-brand flex items-center pl-4"
        style={{ opacity: completeBgOpacity }}
      >
        <motion.div
          style={{ opacity: leftIconOpacity, scale: leftIconScale }}
          className="text-white pointer-events-none"
        >
          <Check className="h-5 w-5" strokeWidth={2.25} />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-4"
        style={{ opacity: deleteBgOpacity }}
      >
        <motion.div
          style={{ opacity: rightIconOpacity, scale: rightIconScale }}
          className="text-white pointer-events-none"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2.25} />
        </motion.div>
      </motion.div>

      <motion.div
        key={`content-${isCompleted}`}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{
          left: isCompleted ? 0 : -100,
          right: isCompleted ? 0 : 100,
        }}
        dragElastic={{
          left: isCompleted ? 0 : 0.25,
          right: isCompleted ? 0 : 0.25,
        }}
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn("relative z-10 bg-background", className)}
        onClick={onClick}
      >
        {children}
      </motion.div>
    </div>
  );
}
