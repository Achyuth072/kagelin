"use client";

import React, { memo } from "react";
import type { LucideIcon } from "lucide-react";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { cn } from "@/lib/utils";
import { useSortableRow, dropLineClasses } from "@/lib/hooks/useSortableRow";
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
    isDragging,
    dropLine,
    dndStyle,
  } = useSortableRow(habit.id, { respectReducedMotion: true });

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "relative bg-background",
        isDragging ? "z-20 opacity-30" : "z-10 opacity-100",
        isDragging && "will-change-transform",
        dropLineClasses(dropLine),
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
