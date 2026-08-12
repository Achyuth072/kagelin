"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  memo,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  MeasuringStrategy,
  DragOverEvent,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  defaultDropAnimationSideEffects,
  defaultAnnouncements,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useJsLoaded } from "@/lib/hooks/use-js-loaded";
import {
  getBoardColumns,
  type ProcessedTasks,
  type TaskGroup,
} from "@/lib/hooks/useTaskViewData";
import type { Task, Project } from "@/lib/types/task";
import type { GroupOption } from "@/lib/types/sorting";
import { SortableBoardTaskCard } from "./SortableBoardTaskCard";
import { TaskGhost } from "./TaskGhost";
import { useUpdateTask, useReorderTasks } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import {
  getTaskUpdatesForGroup,
  computeReorderPairs,
  computeFreezeOrderPairs,
  isDropBlockedGroup,
} from "@/lib/utils/task-dnd";

// dnd-kit announces every onDragOver by default, thrashing aria-live at
// 60-120Hz. Returning undefined is a no-op; start/end/cancel still fire.
const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

interface TaskBoardProps {
  processedTasks: ProcessedTasks;
  projectsMap: Map<string, Project>;
  onSelect?: (task: Task) => void;
  isDesktop: boolean;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId: (taskId: string) => void;
  groupBy?: GroupOption;
  keyboardSelectedId?: string | null;
}

export function TaskBoard({
  processedTasks,
  projectsMap = new Map(),
  onSelect,
  isDesktop,
  triggerHaptic,
  setActiveTaskId,
  groupBy,
  keyboardSelectedId,
}: TaskBoardProps) {
  const isJsLoaded = useJsLoaded();
  const updateTaskMutation = useUpdateTask();
  const reorderMutation = useReorderTasks();
  const sortBy = useUiStore((state) => state.sortBy);
  const setSortBy = useUiStore((state) => state.setSortBy);
  const setCustomSortEnteredViaDrag = useUiStore(
    (state) => state.setCustomSortEnteredViaDrag,
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  // Snapshotted at drag start for the ghost — deriving it per render would
  // flatMap+find over every task on each drag-over.
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // While set, displayColumns reads local drag state instead of server data.
  const [lockLocal, setLockLocal] = useState(false);
  // Cross-column drop: wait for the server to confirm the destination
  // column before releasing the lock, or a stale refetch snaps it back.
  const [pendingLockRelease, setPendingLockRelease] = useState<{
    taskId: string;
    columnTitle: string;
  } | null>(null);

  // Drag-start snapshot: computeReorderPairs needs the server-authoritative
  // day_order of the slots being reordered.
  const preDragFlatTasksRef = useRef<Task[]>([]);

  const boardColumns = useMemo<TaskGroup[]>(
    () => getBoardColumns(processedTasks),
    [processedTasks],
  );

  const [localColumns, setLocalColumns] = useState<TaskGroup[]>(boardColumns);

  // Evaluated in the render body, not an effect — no race window.
  const displayColumns = activeId || lockLocal ? localColumns : boardColumns;

  useEffect(() => {
    if (!activeId && !lockLocal) {
      setLocalColumns(boardColumns);
    }
  }, [boardColumns, activeId, lockLocal]);

  // Release only once the server data actually shows the task in its
  // destination column (see pendingLockRelease above).
  useEffect(() => {
    if (!pendingLockRelease) return;
    const taskInColumn = boardColumns
      .find((col) => col.title === pendingLockRelease.columnTitle)
      ?.tasks.some((t) => t.id === pendingLockRelease.taskId);
    if (taskInColumn) {
      setLockLocal(false);
      setPendingLockRelease(null);
    }
  }, [boardColumns, pendingLockRelease]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const getTaskUpdates = useCallback(
    (groupTitle: string) =>
      getTaskUpdatesForGroup(groupTitle, projectsMap, groupBy),
    [projectsMap, groupBy],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setLocalColumns(boardColumns);
    const id = event.active.id as string;
    setActiveId(id);
    setActiveTask(
      boardColumns.flatMap((c) => c.tasks).find((t) => t.id === id) || null,
    );
    // Custom sort already follows day_order, so sort by it (the flatMap
    // interleaves columns). A derived sort bakes in the on-screen order.
    const visibleTasks = boardColumns.flatMap((col) => col.tasks);
    preDragFlatTasksRef.current =
      sortBy === "custom"
        ? [...visibleTasks].sort((a, b) => a.day_order - b.day_order)
        : visibleTasks;
    triggerHaptic?.("toggle");
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = localColumns.find((col) =>
      col.tasks.some((t) => t.id === activeId),
    );
    const overColumn =
      localColumns.find((col) => col.tasks.some((t) => t.id === overId)) ||
      localColumns.find((col) => col.title === overId);

    if (!activeColumn || !overColumn) return;

    if (activeColumn.title !== overColumn.title) {
      // Derived buckets like "Overdue" have no settable property — the drop
      // could never stick, so don't let the drag enter the column at all.
      if (isDropBlockedGroup(overColumn.title, groupBy)) return;

      setLocalColumns((prev) => {
        const activeColIndex = prev.findIndex(
          (c) => c.title === activeColumn.title,
        );
        const overColIndex = prev.findIndex(
          (c) => c.title === overColumn.title,
        );

        const activeTasks = [...prev[activeColIndex].tasks];
        const overTasks = [...prev[overColIndex].tasks];

        const activeIndex = activeTasks.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        // findIndex on React state can be off-by-one during rapid drag-over.
        let overIndex = over.data?.current?.sortable?.index;
        if (overIndex === undefined) {
          overIndex = overTasks.findIndex((t) => t.id === overId);
        }

        const [movedTask] = activeTasks.splice(activeIndex, 1);

        const updates = getTaskUpdates(overColumn.title);
        const updatedTask = { ...movedTask, ...updates };

        let newIndex;
        if (overId === overColumn.title) {
          newIndex = overTasks.length;
        } else {
          newIndex = overIndex >= 0 ? overIndex : overTasks.length;
        }

        overTasks.splice(newIndex, 0, updatedTask);

        const newCols = [...prev];
        newCols[activeColIndex] = {
          ...prev[activeColIndex],
          tasks: activeTasks,
        };
        newCols[overColIndex] = { ...prev[overColIndex], tasks: overTasks };
        return newCols;
      });
    } else {
      // Everything else runs inside the updater so the closure can't capture
      // a stale localColumns.
      const dndNewIndex = over.data?.current?.sortable?.index;

      setLocalColumns((prev) => {
        const colIndex = prev.findIndex((c) => c.title === activeColumn.title);
        if (colIndex === -1) return prev;

        const prevTasks = [...prev[colIndex].tasks];
        const oldIndex = prevTasks.findIndex((t) => t.id === activeId);
        if (oldIndex === -1) return prev;

        let newIndex = dndNewIndex;
        if (newIndex === undefined) {
          newIndex = prevTasks.findIndex((t) => t.id === overId);
        }
        if (newIndex === undefined || newIndex === -1) return prev;
        // Bail when nothing moves — a fresh column object re-renders
        // KanbanColumn + SortableContext on every drag-over.
        if (newIndex === oldIndex) return prev;

        const newCols = [...prev];
        newCols[colIndex] = {
          ...prev[colIndex],
          tasks: arrayMove(prevTasks, oldIndex, newIndex),
        };
        return newCols;
      });
    }
  };

  const handleDragCancel = () => {
    setLocalColumns(boardColumns);
    setActiveId(null);
    setActiveTask(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Dropped outside any droppable — displayColumns falls back on its own.
    if (!over) {
      setActiveId(null);
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const finalColumn = localColumns.find((col) =>
      col.tasks.some((t) => t.id === activeId),
    );
    // Return before clearing activeId, or displayColumns falls back to
    // server data before the drop is committed.
    if (!finalColumn) {
      setActiveId(null);
      setActiveTask(null);
      return;
    }
    const draggedTask = finalColumn.tasks.find((t) => t.id === activeId);
    if (!draggedTask) {
      setActiveId(null);
      setActiveTask(null);
      return;
    }

    const originalColumn = boardColumns.find((col) =>
      col.tasks.some((t) => t.id === activeId),
    );
    const isSameSection = originalColumn?.title === finalColumn.title;

    // Must be queued before setActiveId(null): batching makes them one render,
    // but the order defends against a partial flush leaving both unset.
    setLockLocal(true);
    if (sortBy !== "custom") {
      // Tells TaskList's freeze effect this switch came from a drag, which
      // computes its own order below.
      setCustomSortEnteredViaDrag(true);
      setSortBy("custom");
    }

    const updates = getTaskUpdates(finalColumn.title);
    const originalTask =
      processedTasks.active.find((t) => t.id === activeId) ||
      processedTasks.evening.find((t) => t.id === activeId);

    const hasChanged =
      originalTask &&
      Object.keys(updates).some(
        (key) =>
          (updates as Record<string, unknown>)[key] !==
          (originalTask as unknown as Record<string, unknown>)[key],
      );

    // Cross-column drops defer the release until the server agrees;
    // same-column reorders release as soon as the mutations settle.
    let pendingCount = 0;
    const tryReleaseLock = () => {
      pendingCount--;
      if (pendingCount <= 0) {
        if (hasChanged) {
          setPendingLockRelease({
            taskId: activeId,
            columnTitle: finalColumn.title,
          });
        } else {
          setLockLocal(false);
        }
      }
    };

    if (hasChanged) {
      pendingCount++;
      updateTaskMutation.mutate(
        { id: activeId, ...updates },
        {
          onSettled: tryReleaseLock,
        },
      );
    }

    // In custom sort day_order is authoritative, so persist just the moved
    // span. Converting from a derived sort leaves every other column's
    // day_order stale, so freeze the whole visible order instead.
    let pairs: { id: string; day_order: number }[];
    if (sortBy === "custom") {
      const orderedIds = finalColumn.tasks.map((t) => t.id);
      pairs = computeReorderPairs(
        activeId,
        orderedIds,
        preDragFlatTasksRef.current,
        isSameSection,
      );
    } else {
      pairs = computeFreezeOrderPairs(localColumns.flatMap((c) => c.tasks));
    }
    if (pairs.length > 0) {
      pendingCount++;
      reorderMutation.mutate(pairs, {
        onSettled: tryReleaseLock,
      });
    }
    // Nothing to persist at all — release the lock now; onSettled never fires.
    if (pendingCount === 0) {
      setLockLocal(false);
    }
    triggerHaptic?.("thud");
    setActiveId(null);
    setActiveTask(null);
  };

  if (!isJsLoaded) return null;

  return (
    <DndContext
      sensors={sensors}
      // For stacked droppables (a column + its items) rectIntersection can
      // resolve to the column itself, dropping tasks at the bottom.
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements: dndAnnouncements }}
      // Always re-measures on every idle droppable mutation too — pure
      // overhead, since both behave identically during a drag.
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.WhileDragging,
        },
      }}
      autoScroll={{
        layoutShiftCompensation: false,
        threshold: {
          x: 0.1,
          y: 0.1,
        },
        acceleration: 10,
      }}
    >
      {/* Snap off mid-drag: it re-adjusts scroll offset after programmatic
          scrolls, fighting dnd-kit's auto-scroll. See ADR 0007. */}
      <div
        className={`flex items-start h-full overflow-x-auto pb-12 md:pb-6 px-4 md:px-6 gap-6 scrollbar-hide${activeId ? "" : " snap-x snap-mandatory"}`}
        data-testid="task-board-container"
      >
        {displayColumns.map((group) => (
          <KanbanColumn
            key={group.title}
            group={group}
            projectsMap={projectsMap}
            isDesktop={isDesktop}
            onSelect={onSelect}
            setActiveTaskId={setActiveTaskId}
            triggerHaptic={triggerHaptic}
            isDndActive={!!activeId}
            // Only the owning column gets a non-null id, so memo on the
            // other columns holds instead of every column re-rendering
            // on each arrow-key press.
            keyboardSelectedId={
              group.tasks.some((t) => t.id === keyboardSelectedId)
                ? keyboardSelectedId
                : null
            }
          />
        ))}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay
            // duration 0 short-circuits the animation entirely. Otherwise
            // it measures the active rect before the optimistic cache update
            // lands, animating to the old position and then snapping.
            dropAnimation={{
              duration: 0,
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: { opacity: "0.5" },
                },
              }),
            }}
          >
            {activeTask ? (
              <div className="opacity-90 pointer-events-none will-change-transform rotate-1 scale-[1.02]">
                <TaskGhost
                  task={activeTask}
                  isDesktop={isDesktop}
                  viewMode="board"
                  project={projectsMap?.get?.(activeTask.project_id || "inbox")}
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  group,
  projectsMap,
  isDesktop,
  onSelect,
  setActiveTaskId,
  triggerHaptic,
  isDndActive,
  keyboardSelectedId,
}: {
  group: TaskGroup;
  projectsMap: Map<string, Project>;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  setActiveTaskId: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  isDndActive: boolean;
  keyboardSelectedId?: string | null;
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
          className="px-3 pt-1.5 pb-4 scroll-py-1.5 space-y-3 flex-1 overflow-y-auto scrollbar-hide"
        >
          {group.tasks.map((task) => (
            <TaskCardWrapper
              key={task.id}
              task={task}
              project={projectsMap.get(task.project_id || "inbox")}
              isDesktop={isDesktop}
              onSelect={onSelect}
              setActiveTaskId={setActiveTaskId}
              triggerHaptic={triggerHaptic}
              _isDndActive={isDndActive}
              isKeyboardSelected={task.id === keyboardSelectedId}
            />
          ))}
          {group.tasks.length === 0 && (
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/30 rounded-2xl opacity-40">
              <span className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                Ma (Void)
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
});

const TaskCardWrapper = memo(function TaskCardWrapper({
  task,
  project,
  isDesktop,
  onSelect,
  setActiveTaskId,
  triggerHaptic,
  _isDndActive,
  isKeyboardSelected,
}: {
  task: Task;
  project: Project | undefined;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  setActiveTaskId: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  _isDndActive: boolean;
  isKeyboardSelected?: boolean;
}) {
  return (
    <SortableBoardTaskCard
      task={task}
      project={
        project ? { color: project.color, name: project.name } : undefined
      }
      isDesktop={isDesktop}
      onSelect={onSelect}
      triggerHaptic={triggerHaptic}
      setActiveTaskId={setActiveTaskId}
      isKeyboardSelected={isKeyboardSelected}
    />
  );
});
