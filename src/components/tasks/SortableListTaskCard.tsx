"use client";

import React, { memo } from "react";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/lib/types/task";
import type { TaskViewMode } from "@/lib/types/sorting";
import { cn } from "@/lib/utils";
import { useSortableRow, dropLineClasses } from "@/lib/hooks/useSortableRow";

interface SortableListTaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
  isKeyboardSelected?: boolean;
  viewMode?: TaskViewMode;
  isDndActive?: boolean;
  // Shared props
  project?: { color: string; name: string };
  isDesktop?: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId?: (taskId: string) => void;
}

// Memoized — useSortable re-renders the parent every frame during drag.
const TaskItemContent = memo(
  ({
    task,
    onSelect,
    isKeyboardSelected,
    viewMode,
    attributes,
    listeners,
    isDragging,
    setActivatorNodeRef,
    isDndActive,
    project,
    isDesktop,
    triggerHaptic,
    setActiveTaskId,
  }: SortableListTaskCardProps & {
    attributes: import("@dnd-kit/core").DraggableAttributes;
    listeners: import("@dnd-kit/core").DraggableSyntheticListeners | undefined;
    isDragging: boolean;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => {
    return (
      <TaskItem
        task={task}
        onSelect={onSelect}
        dragListeners={listeners}
        dragAttributes={attributes}
        isDragging={isDragging}
        isKeyboardSelected={isKeyboardSelected}
        viewMode={viewMode}
        dragActivatorRef={setActivatorNodeRef}
        isDndActive={isDndActive}
        project={project}
        isDesktop={isDesktop}
        triggerHaptic={triggerHaptic}
        setActiveTaskId={setActiveTaskId}
      />
    );
  },
  (prev, next) => {
    return (
      prev.task.id === next.task.id &&
      prev.task.content === next.task.content &&
      prev.task.is_completed === next.task.is_completed &&
      prev.task.priority === next.task.priority &&
      prev.task.subtasks === next.task.subtasks &&
      prev.isKeyboardSelected === next.isKeyboardSelected &&
      prev.viewMode === next.viewMode &&
      prev.isDragging === next.isDragging &&
      prev.isDndActive === next.isDndActive &&
      prev.project?.color === next.project?.color &&
      prev.isDesktop === next.isDesktop
    );
  },
);

TaskItemContent.displayName = "TaskItemContent";

export default function SortableListTaskCard({
  task,
  onSelect,
  isKeyboardSelected,
  viewMode,
  isDndActive,
  project,
  isDesktop,
  triggerHaptic,
  setActiveTaskId,
}: SortableListTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
    dropLine,
    dndStyle,
  } = useSortableRow(task.id);

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "relative",
        !isDndActive &&
          "transition-[background-color,border-color,opacity,box-shadow,ring,height] duration-200",
        "last:[&_[data-task-row]]:border-b-transparent",
        isDragging ? "opacity-30 z-20" : "opacity-100 z-10",
        isDragging && "will-change-transform",
        dropLineClasses(dropLine),
      )}
    >
      <TaskItemContent
        task={task}
        onSelect={onSelect}
        isKeyboardSelected={isKeyboardSelected}
        viewMode={viewMode}
        attributes={attributes}
        listeners={listeners}
        isDragging={isDragging}
        setActivatorNodeRef={setActivatorNodeRef}
        isDndActive={isDndActive}
        project={project}
        isDesktop={isDesktop}
        triggerHaptic={triggerHaptic}
        setActiveTaskId={setActiveTaskId}
      />
    </div>
  );
}
