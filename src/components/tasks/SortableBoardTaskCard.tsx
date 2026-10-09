"use client";

import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

interface SortableBoardTaskCardProps {
  task: Task;
  project: { color: string; name: string | null } | undefined;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId?: (taskId: string) => void;
  isKeyboardSelected?: boolean;
}

export const SortableBoardTaskCard = memo(function SortableBoardTaskCard({
  task,
  project,
  isDesktop,
  onSelect,
  triggerHaptic,
  setActiveTaskId,
  isKeyboardSelected,
}: SortableBoardTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const { onKeyDown: _, ...pointerListeners } = listeners ?? {};
  const cardAttributes = isDesktop ? undefined : attributes;
  const cardListeners = isDesktop ? pointerListeners : listeners;

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    // Gated on transform to avoid post-drop snap-back animation.
    transition: transform ? transition : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg will-change-transform group",
        !isDragging && "transition-shadow duration-200",
      )}
    >
      <div
        {...cardAttributes}
        {...cardListeners}
        className="w-full h-full"
        onClick={() => onSelect?.(task)}
      >
        {/* Kept on wrapper to avoid busting TaskItem memo on drag-over. */}
        <TaskItem
          task={task}
          project={project}
          isDesktop={isDesktop}
          onSelect={onSelect}
          triggerHaptic={triggerHaptic}
          setActiveTaskId={setActiveTaskId}
          viewMode="board"
          isKeyboardSelected={isKeyboardSelected}
        />
      </div>
    </div>
  );
});
