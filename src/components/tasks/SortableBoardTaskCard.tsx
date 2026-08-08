"use client";

import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { TaskItem } from "./TaskItem";
import { DragHandle } from "./DragHandle";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

interface SortableBoardTaskCardProps {
  task: Task;
  project: { color: string; name: string } | undefined;
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
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  // Desktop: keyboard-drag activation (Space/Enter) collides with the Vim
  // shortcuts bound to the same keys, so it moves to a dedicated handle —
  // pointer dragging stays card-wide via the onMouseDown/onTouchStart
  // listeners left on the wrapper. Mobile keeps the old full spread;
  // keyboard drag isn't a mobile concern and there's no handle to hit.
  const { onKeyDown: _onKeyDown, ...pointerListeners } = listeners ?? {};
  const cardAttributes = isDesktop ? undefined : attributes;
  const cardListeners = isDesktop ? pointerListeners : listeners;

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    // Gate transition on transform != null, or the post-drop reset to
    // translate3d(0,0,0) animates as a visible snap-back.
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
        {/* attributes/listeners stay on the wrapper div, not TaskItem —
            forwarding them busts its memo on every drag-over. */}
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
      {isDesktop && (
        <DragHandle
          ref={setActivatorNodeRef}
          dragAttributes={attributes}
          dragListeners={listeners}
          variant="desktop"
          // Right-edge, vertically centered — the header row's Play button
          // already claims the top-right corner on hover. Also revealed on
          // focus-within (not just hover), so tabbing to it doesn't land on
          // an invisible control.
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 rounded-md p-1 hover:bg-secondary/60 group-focus-within:opacity-100"
        />
      )}
    </div>
  );
});
