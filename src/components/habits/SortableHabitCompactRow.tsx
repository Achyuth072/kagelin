"use client";

import React, { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { HabitCompactRow } from "./HabitCompactRow";

interface SortableHabitCompactRowProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onEdit?: () => void;
  isDesktop?: boolean;
}

/**
 * HabitRowContent is memoized so the row doesn't re-render on every drag frame.
 * useSortable in the wrapper triggers re-renders at 60fps; the content only
 * re-renders when its own props actually change.
 */
const HabitRowContent = memo(
  ({
    habit,
    icon,
    onEdit,
    isDesktop,
    attributes,
    listeners,
    setActivatorNodeRef,
  }: SortableHabitCompactRowProps & {
    attributes: import("@dnd-kit/core").DraggableAttributes;
    listeners: import("@dnd-kit/core").DraggableSyntheticListeners | undefined;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => {
    return (
      <HabitCompactRow
        habit={habit}
        icon={icon}
        onEdit={onEdit}
        isDesktop={isDesktop}
        dragListeners={listeners}
        dragAttributes={attributes}
        dragActivatorRef={setActivatorNodeRef}
      />
    );
  },
  (prev, next) =>
    prev.habit === next.habit &&
    prev.icon === next.icon &&
    prev.isDesktop === next.isDesktop,
);

HabitRowContent.displayName = "HabitRowContent";

/**
 * Drag wrapper for the compact view. Mirrors SortableListTaskCard: a sortable
 * node with a transform-gated transition (the documented snap-back fix) and a
 * drop-line indicator. Content is memoized to survive 60fps drag re-renders.
 */
export function SortableHabitCompactRow({
  habit,
  icon,
  onEdit,
  isDesktop,
}: SortableHabitCompactRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
    over,
  } = useSortable({ id: habit.id });
  const prefersReducedMotion = usePrefersReducedMotion();

  // Determine drop indicator position.
  let dropLine: "none" | "top" | "bottom" = "none";
  if (isOver && !isDragging) {
    const activeIndex = active?.data.current?.sortable?.index;
    const overIndex = over?.data.current?.sortable?.index;
    if (activeIndex !== undefined && overIndex !== undefined) {
      dropLine = activeIndex < overIndex ? "bottom" : "top";
    } else {
      dropLine = "top";
    }
  }

  const dndStyle = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    // Gate `transition` on transform != null: avoids the browser animating the
    // last drag offset back to translate3d(0,0,0) post-drop (the snap-back).
    transition: transform && !prefersReducedMotion ? transition : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "relative bg-background",
        isDragging ? "z-20 opacity-30" : "z-10 opacity-100",
        isDragging && "will-change-transform",
        dropLine === "top" &&
          "before:absolute before:left-0 before:right-0 before:top-0 before:z-[50] before:h-[2px] before:rounded-full before:bg-primary",
        dropLine === "bottom" &&
          "after:absolute after:bottom-0 after:left-0 after:right-0 after:z-[50] after:h-[2px] after:rounded-full after:bg-primary",
      )}
    >
      <HabitRowContent
        habit={habit}
        icon={icon}
        onEdit={onEdit}
        isDesktop={isDesktop}
        attributes={attributes}
        listeners={listeners}
        setActivatorNodeRef={setActivatorNodeRef}
      />
    </div>
  );
}
