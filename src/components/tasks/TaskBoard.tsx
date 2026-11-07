"use client";

import React, { useMemo, memo, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useJsLoaded } from "@/lib/hooks/use-js-loaded";
import { getBoardColumns, type TaskGroup } from "@/lib/hooks/useTaskViewData";
import type { Task, Project } from "@/lib/types/task";
import type { GroupOption } from "@/lib/types/sorting";
import type { TaskPresentation } from "@/lib/types/task-view";
import { cn } from "@/lib/utils";
import { taskDomId } from "./task-utils";
import { SortableBoardTaskCard } from "./SortableBoardTaskCard";

export interface TaskBoardProps {
  presentation?: TaskPresentation;
  projectsMap?: Map<string, Project>;
  onSelect?: (task: Task) => void;
  isDesktop?: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId: (taskId: string) => void;
  groupBy?: GroupOption;
  keyboardSelectedId?: string | null;
  /** Task currently open in the split inspector or overlay drawer. */
  inspectedTaskId?: string | null;
  isDndActive?: boolean;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  hasOverlayDrawer?: boolean;
  onAddTask?: () => void;
}

const OVERLAY_DRAWER_WIDTH = 440;
const SCROLL_CLEARANCE = 24;

function scrollElementBy(el: HTMLElement, left: number) {
  if (typeof el.scrollBy === "function") {
    el.scrollBy({ left, behavior: "smooth" });
  } else {
    el.scrollLeft += left;
  }
}

// Checks whether the wheel event target is inside a scrollable column container
// that still has vertical headroom in the direction of `deltaY`.
function hasVerticalScrollHeadroom(
  target: EventTarget | null,
  boundary: HTMLElement,
  deltaY: number,
): boolean {
  let el = target as HTMLElement | null;

  while (el && el !== boundary) {
    if (
      el.getAttribute?.("role") === "row" ||
      el.classList?.contains("overflow-y-auto")
    ) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1) {
        return true;
      }
      if (deltaY < 0 && scrollTop > 1) {
        return true;
      }
    }
    el = el.parentElement;
  }

  return false;
}

export function TaskBoard({
  presentation,
  projectsMap = new Map(),
  onSelect,
  isDesktop = false,
  triggerHaptic = () => {},
  setActiveTaskId,
  groupBy: _groupBy,
  keyboardSelectedId,
  inspectedTaskId,
  isDndActive = false,
  onScroll,
  hasOverlayDrawer = false,
  onAddTask,
}: TaskBoardProps) {
  const isJsLoaded = useJsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);

  const boardColumns = useMemo<TaskGroup[]>(
    () => (presentation ? getBoardColumns(presentation) : []),
    [presentation],
  );

  // Keep the Vim selection or inspected task in view.
  const scrollTargetId = keyboardSelectedId ?? inspectedTaskId;

  useEffect(() => {
    if (!containerRef.current || !scrollTargetId) {
      return;
    }

    const checkAndScroll = () => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const targetCard = el.querySelector(
        `[id="${taskDomId(scrollTargetId)}"]`,
      ) as HTMLElement | null;

      if (!targetCard) return;

      const targetColumn = targetCard.closest("section");
      const columnRect = targetColumn
        ? targetColumn.getBoundingClientRect()
        : targetCard.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();

      const visibleRight = hasOverlayDrawer
        ? containerRect.right - OVERLAY_DRAWER_WIDTH
        : containerRect.right;

      if (columnRect.right > visibleRight) {
        scrollElementBy(el, columnRect.right - visibleRight + SCROLL_CLEARANCE);
      } else if (columnRect.left < containerRect.left) {
        scrollElementBy(
          el,
          columnRect.left - containerRect.left - SCROLL_CLEARANCE,
        );
      }
    };

    checkAndScroll();
    const timer = setTimeout(checkAndScroll, 220);
    return () => clearTimeout(timer);
  }, [hasOverlayDrawer, scrollTargetId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Allow native horizontal scrolling when holding Shift or using trackpad horizontal gesture
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }

      // Preserve vertical scrolling when the wheel target is inside a column with scroll headroom
      if (hasVerticalScrollHeadroom(e.target, el, e.deltaY)) {
        return;
      }

      const hasHorizontalOverflow =
        el.scrollWidth > el.clientWidth ||
        (el.scrollWidth === 0 && el.clientWidth === 0);

      if (hasHorizontalOverflow) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  if (!isJsLoaded) return null;

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      data-task-list-scroll-container="true"
      data-testid="task-board-container"
      className={cn(
        "flex items-start h-full overflow-x-auto pb-12 md:pb-6 px-4 md:px-6 gap-6 transition-[padding] duration-200 motion-reduce:transition-none",
        isDesktop ? "custom-scrollbar" : "scrollbar-hide",
        !isDndActive && "snap-x snap-mandatory",
        hasOverlayDrawer && "pr-[464px]",
      )}
    >
      {boardColumns.map((group) => (
        <KanbanColumn
          key={group.title}
          group={group}
          projectsMap={projectsMap}
          isDesktop={isDesktop}
          onSelect={onSelect}
          setActiveTaskId={setActiveTaskId}
          triggerHaptic={triggerHaptic}
          onAddTask={onAddTask}
          keyboardSelectedId={
            group.tasks.some((t) => t.id === keyboardSelectedId)
              ? keyboardSelectedId
              : null
          }
        />
      ))}
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  group,
  projectsMap,
  isDesktop,
  onSelect,
  setActiveTaskId,
  triggerHaptic,
  keyboardSelectedId,
  onAddTask,
}: {
  group: TaskGroup;
  projectsMap: Map<string, Project>;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  setActiveTaskId: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  keyboardSelectedId?: string | null;
  onAddTask?: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: group.title });

  // Without shrink-0 the flex columns compress to fit, so the board never
  // overflows and neither snap nor drag auto-scroll has anything to scroll.
  return (
    <section
      ref={setNodeRef}
      className="w-[85vw] md:w-[320px] shrink-0 snap-center bg-sidebar border border-border rounded-2xl flex flex-col p-0.5 max-h-[calc(100dvh-200px)] md:max-h-full"
    >
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h3 className="type-h3 lowercase tracking-tight text-foreground/70">
          {group.title}
          <span className="ml-2 text-[11px] font-bold opacity-40 tabular-nums">
            {group.tasks.length}
          </span>
        </h3>
      </div>

      <SortableContext
        items={group.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          role="row"
          data-task-list-scroll-container="true"
          className="px-3 pt-1.5 pb-4 scroll-py-1.5 space-y-3 flex-1 overflow-y-auto scrollbar-hide"
        >
          {group.tasks.map((task) => {
            const project = projectsMap.get(task.project_id || "inbox");
            return (
              <SortableBoardTaskCard
                key={task.id}
                task={task}
                project={
                  project
                    ? { color: project.color, name: project.name }
                    : undefined
                }
                isDesktop={isDesktop}
                onSelect={onSelect}
                triggerHaptic={triggerHaptic}
                setActiveTaskId={setActiveTaskId}
                isKeyboardSelected={task.id === keyboardSelectedId}
              />
            );
          })}
          {group.tasks.length === 0 && (
            <div className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-2xl">
              <span className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                Ma (Void)
              </span>
              {onAddTask && (
                <button
                  type="button"
                  onClick={onAddTask}
                  aria-label="Add task"
                  className="min-h-11 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  + Add task
                </button>
              )}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
});
