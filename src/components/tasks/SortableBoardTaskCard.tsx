"use client";

import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

interface SortableBoardTaskCardProps {
  task: Task;
  project: { color: string; name: string } | undefined;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId?: (taskId: string) => void;
}

export const SortableBoardTaskCard = memo(function SortableBoardTaskCard({
  task,
  project,
  isDesktop,
  onSelect,
  triggerHaptic,
  setActiveTaskId,
}: SortableBoardTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    // Bug A fix: gate `transition` on transform != null. useSortable returns a
    // `transition: "transform Xms ease"` string whenever SortableContext.items
    // mutates. If left active when transform becomes null (post-drop steady
    // state), the browser animates transform from the last drag offset back to
    // translate3d(0,0,0), producing the visible "snap-back" the user reported.
    // Idiomatic dnd-kit pattern is to only apply transition while transform is
    // present. See .planning/debug/dnd-audit-2026-05-14.md for full analysis.
    transition: transform ? transition : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg will-change-transform",
        !isDragging && "transition-shadow duration-200",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-full h-full"
        onClick={() => onSelect?.(task)}
      >
        {/* Drag activation lives on the wrapper div above (it spreads
            attributes+listeners). BoardTaskCard never consumes dragListeners/
            dragAttributes, so forwarding them here only poisoned TaskItem's
            React.memo — dnd-kit hands back fresh identities each reorder,
            forcing every card's TaskItem subtree to re-render on every
            drag-over. Omitting them lets the memo hold. */}
        <TaskItem
          task={task}
          project={project}
          isDesktop={isDesktop}
          onSelect={onSelect}
          triggerHaptic={triggerHaptic}
          setActiveTaskId={setActiveTaskId}
          viewMode="board"
        />
      </div>
    </div>
  );
});
