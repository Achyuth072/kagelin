"use client";

import { useSortable } from "@dnd-kit/sortable";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export type DropLine = "none" | "top" | "bottom";

interface UseSortableRowOptions {
  /**
   * Suppress the post-drop transition for reduced-motion users. Off by default
   * to preserve the task list's behavior; the habit compact row opts in.
   */
  respectReducedMotion?: boolean;
}

interface SortableRowState {
  setNodeRef: (node: HTMLElement | null) => void;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  isDragging: boolean;
  dropLine: DropLine;
  dndStyle: React.CSSProperties;
}

/**
 * Shared drag-row state for vertical sortable lists (task list + habit compact
 * row). Centralizes the two load-bearing pieces that must stay in lockstep
 * across both surfaces:
 *
 *  - the drop-indicator position (top/bottom) derived from sortable indices, and
 *  - the dndStyle whose `transition` is gated on `transform != null` so the
 *    browser doesn't animate the last drag offset back to translate3d(0,0,0)
 *    after drop (the documented snap-back fix).
 */
export function useSortableRow(
  id: string,
  { respectReducedMotion = false }: UseSortableRowOptions = {},
): SortableRowState {
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
  } = useSortable({ id });
  const prefersReducedMotion = usePrefersReducedMotion();

  let dropLine: DropLine = "none";
  if (isOver && !isDragging) {
    const activeIndex = active?.data.current?.sortable?.index;
    const overIndex = over?.data.current?.sortable?.index;
    if (activeIndex !== undefined && overIndex !== undefined) {
      dropLine = activeIndex < overIndex ? "bottom" : "top";
    } else {
      dropLine = "top";
    }
  }

  const allowTransition = !(respectReducedMotion && prefersReducedMotion);
  const dndStyle: React.CSSProperties = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition: transform && allowTransition ? transition : undefined,
  };

  return {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
    dropLine,
    dndStyle,
  };
}

/**
 * Pseudo-element classes for the drop-indicator line at the row's top/bottom.
 * Shared so the indicator looks identical in every sortable list.
 */
export function dropLineClasses(dropLine: DropLine): string | false {
  if (dropLine === "top") {
    return "before:absolute before:left-0 before:right-0 before:top-0 before:z-[50] before:h-[2px] before:rounded-full before:bg-primary";
  }
  if (dropLine === "bottom") {
    return "after:absolute after:bottom-0 after:left-0 after:right-0 after:z-[50] after:h-[2px] after:rounded-full after:bg-primary";
  }
  return false;
}
