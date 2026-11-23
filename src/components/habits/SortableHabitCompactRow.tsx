"use client";

import React, { memo } from "react";
import type { LucideIcon } from "lucide-react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { cn } from "@/lib/utils";
import { useSortableRow, dropLineClasses } from "@/lib/hooks/useSortableRow";
import { HabitCompactRow } from "./HabitCompactRow";

interface SortableHabitCompactRowProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onEdit?: () => void;
  onViewInsights?: () => void;
  isDesktop?: boolean;
  isDndDisabled?: boolean;
}

// Memoized to prevent useSortable drag frames from re-rendering row contents.
const HabitRowContent = memo(
  ({
    habit,
    icon,
    onEdit,
    onViewInsights,
    isDesktop,
    attributes,
    listeners,
    setActivatorNodeRef,
  }: SortableHabitCompactRowProps & {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners | undefined;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => {
    return (
      <HabitCompactRow
        habit={habit}
        icon={icon}
        onEdit={onEdit}
        onViewInsights={onViewInsights}
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
    prev.onViewInsights === next.onViewInsights &&
    prev.isDesktop === next.isDesktop,
);

HabitRowContent.displayName = "HabitRowContent";

export function SortableHabitCompactRow({
  habit,
  icon,
  onEdit,
  onViewInsights,
  isDesktop,
  isDndDisabled = false,
}: SortableHabitCompactRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
    dropLine,
    dndStyle,
  } = useSortableRow(habit.id, {
    respectReducedMotion: true,
    disabled: isDndDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "relative bg-card",
        isDragging ? "z-20 opacity-30" : "z-10 opacity-100",
        isDragging && "will-change-transform",
        dropLineClasses(dropLine),
      )}
    >
      <HabitRowContent
        habit={habit}
        icon={icon}
        onEdit={onEdit}
        onViewInsights={onViewInsights}
        isDesktop={isDesktop}
        attributes={attributes}
        listeners={listeners}
        setActivatorNodeRef={setActivatorNodeRef}
      />
    </div>
  );
}
