"use client";

import React, { useState, useRef, useEffect } from "react";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { CollapsibleReveal } from "./shared/CollapsibleReveal";
import { useDeleteTask, useToggleTask } from "@/lib/hooks/useTaskMutations";
import { useTimerStore } from "@/lib/store/timerStore";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import type { TaskViewMode } from "@/lib/types/sorting";
import dynamic from "next/dynamic";

// Lazy-loaded to cut initial render weight (PERF-02).
const SubtaskList = dynamic(() => import("./SubtaskList"), {
  loading: () => <div className="h-16 animate-pulse bg-muted/30 rounded-lg" />,
  ssr: false,
});

import { useRouter } from "next/navigation";
import { BoardTaskCard } from "./BoardTaskCard";
import { ListTaskCard } from "./ListTaskCard";
import { SwipeableTaskContent } from "./SwipeableTaskContent";

interface TaskItemProps {
  task: Task;
  onSelect?: (task: Task) => void;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  isDragging?: boolean;
  isKeyboardSelected?: boolean;
  viewMode?: TaskViewMode;
  dragActivatorRef?: (element: HTMLElement | null) => void;
  isDndActive?: boolean;
  project?: { color: string; name: string };
  isDesktop?: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId?: (taskId: string) => void;
}

function TaskItemBase({
  task,
  onSelect,
  dragListeners,
  dragAttributes,
  isDragging = false,
  isKeyboardSelected = false,
  viewMode = "list",
  dragActivatorRef,
  isDndActive,
  project,
  isDesktop = false,
  triggerHaptic,
  setActiveTaskId,
}: TaskItemProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [_isChecking, setIsChecking] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHandleActive, setIsHandleActive] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const deleteMutation = useDeleteTask();
  const toggleMutation = useToggleTask();
  const router = useRouter();

  useEffect(() => {
    if (isKeyboardSelected && cardRef.current) {
      cardRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isKeyboardSelected]);

  const handlePlayFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic?.("thud");
    setActiveTaskId?.(task.id);
    useTimerStore.getState().requestFocusStart();
    router.push("/focus");
  };

  const handleComplete = (checked: boolean) => {
    triggerHaptic?.(checked ? "success" : "toggle");
    setIsChecking(true);
    if (checked) {
      setShouldAnimate(true);
      setTimeout(() => setShouldAnimate(false), 1000);
    } else {
      setShouldAnimate(false);
    }
    toggleMutation.mutate(
      { id: task.id, is_completed: checked },
      {
        onSettled: () => setIsChecking(false),
      },
    );
  };

  const handleConfirmDelete = () => {
    if (pendingDelete) {
      deleteMutation.mutate(task.id);
      setPendingDelete(false);
    }
  };

  const handleCancelDelete = () => {
    setPendingDelete(false);
    setShowDeleteDialog(false);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic?.("toggle");
    setIsExpanded(!isExpanded);
  };

  const contentClassName = "relative flex group items-center cursor-pointer";

  return (
    <div
      ref={cardRef}
      className={cn(
        "group/item",
        isExpanded && "pb-4",
        isDragging && "will-change-transform",
        task.is_completed && "task-ink-completed-card",
      )}
    >
      {viewMode === "board" ? (
        <BoardTaskCard
          task={task}
          project={project}
          handleComplete={handleComplete}
          handlePlayFocus={handlePlayFocus}
          onClick={() => onSelect?.(task)}
          shouldAnimate={shouldAnimate}
          isKeyboardSelected={isKeyboardSelected}
        />
      ) : isDesktop ? (
        /* Desktop fast path: no Framer Motion wrapper, which thrashed
           sidebar layout. */
        <div
          className={cn(contentClassName, "overflow-hidden rounded-md")}
          style={{ isolation: "isolate" }}
          onClick={() => onSelect?.(task)}
        >
          <ListTaskCard
            task={task}
            isDesktop={isDesktop}
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            handleComplete={handleComplete}
            handlePlayFocus={handlePlayFocus}
            onDeleteRequest={(e) => {
              e.stopPropagation();
              setPendingDelete(true);
              setShowDeleteDialog(true);
            }}
            project={project}
            dragListeners={dragListeners}
            dragAttributes={dragAttributes}
            onHandlePointerDown={() => setIsHandleActive(true)}
            onHandlePointerUp={() => setIsHandleActive(false)}
            dragActivatorRef={dragActivatorRef}
            shouldAnimate={shouldAnimate}
            isKeyboardSelected={isKeyboardSelected}
          />
        </div>
      ) : (
        /* Mobile: swipeable, suspended during DnD to save the per-frame cost. */
        <SwipeableTaskContent
          isDesktop={isDesktop}
          _isDragging={isDragging}
          _isHandleActive={isHandleActive}
          isCompleted={task.is_completed}
          onSwipeLeft={() => {
            triggerHaptic?.("thud");
            setPendingDelete(true);
            setShowDeleteDialog(true);
          }}
          onSwipeRight={() => {
            triggerHaptic?.("thud");
            onSelect?.(task);
          }}
          onSwipeStart={() => setIsSwipeDragging(true)}
          onSwipeEnd={() => setIsSwipeDragging(false)}
          className={contentClassName}
          onClick={() => {
            if (!isSwipeDragging && onSelect) {
              onSelect(task);
            }
          }}
          suspended={isDndActive}
        >
          <ListTaskCard
            task={task}
            isDesktop={isDesktop}
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            handleComplete={handleComplete}
            handlePlayFocus={handlePlayFocus}
            onDeleteRequest={(e) => {
              e.stopPropagation();
              setPendingDelete(true);
              setShowDeleteDialog(true);
            }}
            project={project}
            dragListeners={dragListeners}
            dragAttributes={dragAttributes}
            onHandlePointerDown={() => setIsHandleActive(true)}
            onHandlePointerUp={() => setIsHandleActive(false)}
            dragActivatorRef={dragActivatorRef}
            shouldAnimate={shouldAnimate}
            isKeyboardSelected={isKeyboardSelected}
          />
        </SwipeableTaskContent>
      )}

      {/* Skipped while dragging — the motion layer costs per frame, per row. */}
      <CollapsibleReveal
        open={isExpanded && !isDndActive}
        className={cn(
          "mr-1 pl-4 border-t border-border/10",
          isDesktop ? "ml-10" : "ml-11",
        )}
      >
        <div className="pt-2">
          <SubtaskList taskId={task.id} projectId={task.project_id} />
        </div>
      </CollapsibleReveal>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.content}"? This action cannot be undone.`}
      />
    </div>
  );
}

export const TaskItem = React.memo(TaskItemBase);
