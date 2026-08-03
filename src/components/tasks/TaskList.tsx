"use client";

import { CheckSquare, Plus } from "lucide-react";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  defaultAnnouncements,
  closestCorners,
  DndContext,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import TaskSheet from "./TaskSheet";
import type { Task, Project } from "@/lib/types/task";
import type { SortOption, GroupOption } from "@/lib/types/sorting";
import type { TaskGroup } from "@/lib/hooks/useTaskViewData";
import {
  getTaskUpdatesForGroup,
  computeReorderPairs,
  computeFreezeOrderPairs,
  isDropBlockedGroup,
} from "@/lib/utils/task-dnd";
import {
  useReorderTasks,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
} from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useHotkeys } from "react-hotkeys-hook";
import { useTaskViewData } from "@/lib/hooks/useTaskViewData";
import { TaskListView } from "./TaskListView";
import { TaskBoard } from "./TaskBoard";
import { TaskGhost } from "./TaskGhost";
import { useTimerStore } from "@/lib/store/timerStore";

// dnd-kit announces on every onDragOver by default, thrashing aria-live at
// drag-over frequency — no-op it and keep only start/end/cancel announcements.
const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

// Pure and hoisted to module scope — dnd-kit calls this every auto-scroll tick during a drag.
function canScrollTaskListContainer(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (
    element.tagName === "BODY" ||
    element.tagName === "HTML" ||
    element.classList.contains("no-dnd-scroll")
  ) {
    return false;
  }
  return element.dataset.taskListScrollContainer === "true";
}

interface TaskListProps {
  sortBy?: SortOption;
  groupBy?: GroupOption;
  projectId?: string | null;
  filter?: string;
  onTaskSelect?: (task: Task) => void;
}

function TaskListBase({
  sortBy = "date",
  groupBy = "none",
  projectId,
  filter,
  onTaskSelect,
}: TaskListProps) {
  const { data: tasks = [], isLoading } = useTasks({ projectId, filter });
  const { data: projectsData } = useProjects();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Captured once at drag start for the DragOverlay ghost — deriving it every
  // render would re-run flatMap+find over every task on each drag-over tick.
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // Keeps displaying local DnD state after activeId clears, until the
  // reorder mutation's onSettled fires and the optimistic cache update is live.
  const [lockLocal, setLockLocal] = useState(false);
  const [keyboardSelectedId, setKeyboardSelectedId] = useState<string | null>(
    null,
  );

  const queryClient = useQueryClient();
  const reorderMutation = useReorderTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const toggleMutation = useToggleTask();
  const setSortBy = useUiStore((state) => state.setSortBy);
  const customSortEnteredViaDrag = useUiStore(
    (state) => state.customSortEnteredViaDrag,
  );
  const setCustomSortEnteredViaDrag = useUiStore(
    (state) => state.setCustomSortEnteredViaDrag,
  );
  const viewMode = useUiStore((state) => state.viewMode);
  const isDesktop = useUiStore((state) => state.isDesktop);
  const selectedTaskId = useUiStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useUiStore((state) => state.setSelectedTaskId);
  const { openAddTask } = useTaskActions();
  const { trigger: triggerHaptic } = useHaptic();
  const setActiveTaskId = useTimerStore((state) => state.setActiveTaskId);

  // --- Optimization: Stabilize Sensors ---
  const mouseSensor = useSensor(MouseSensor, {
    // If we're on mobile (!isDesktop), we enforce a delay even for mouse pointers
    // to match TouchSensor behavior and prevent DevTools swipes from clashing.
    activationConstraint: isDesktop
      ? { distance: 5 }
      : { delay: 250, tolerance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Pre-calculate project map for O(1) lookups in subcomponents
  const projectsMap = useMemo(() => {
    const map = new Map<string, Project>();
    if (projectsData) {
      for (let i = 0; i < projectsData.length; i++) {
        map.set(projectsData[i].id, projectsData[i]);
      }
    }
    return map;
  }, [projectsData]);

  const processedTasks = useTaskViewData({
    tasks,
    sortBy,
    groupBy,
    projects: projectsData,
  });

  const [localActive, setLocalActive] = useState<Task[]>(processedTasks.active);
  const [localEvening, setLocalEvening] = useState<Task[]>(
    processedTasks.evening,
  );
  const [localGroups, setLocalGroups] = useState<TaskGroup[] | null>(
    processedTasks.groups,
  );

  const displayTasks =
    activeId || lockLocal ? localActive : processedTasks.active;
  const displayEveningTasks =
    activeId || lockLocal ? localEvening : processedTasks.evening;
  const displayGroups =
    activeId || lockLocal ? localGroups : processedTasks.groups;

  const getTaskUpdates = useCallback(
    (groupTitle: string) =>
      getTaskUpdatesForGroup(groupTitle, projectsMap, groupBy),
    [projectsMap, groupBy],
  );

  // Fed to computeReorderPairs in handleDragEnd — a drop bakes the display
  // order (derived sort) or day_order (custom sort) into the custom order.
  const preDragFlatTasksRef = useRef<Task[]>([]);

  // Freezes the pre-switch order into day_order when switching to "custom"
  // sort (day_order is otherwise stale, causing a visible jump-then-revert).
  // Must read prevDisplayedFlatRef, not the already-resorted processedTasks,
  // via useLayoutEffect so the first custom-sorted paint is already correct.
  // Skipped for drag-driven switches — the drag path bakes its own order.
  const prevSortByRef = useRef(sortBy);
  const prevDisplayedFlatRef = useRef<Task[]>([]);
  useLayoutEffect(() => {
    const prevSortBy = prevSortByRef.current;
    prevSortByRef.current = sortBy;

    // Read the snapshot captured under the OLD sort, then refresh the ref to
    // the current sort's order for the next transition.
    const prevDisplayed = prevDisplayedFlatRef.current;
    prevDisplayedFlatRef.current = processedTasks.groups
      ? processedTasks.groups.flatMap((g) => g.tasks)
      : [...processedTasks.active, ...processedTasks.evening];

    if (sortBy !== "custom" || prevSortBy === "custom") return;
    if (customSortEnteredViaDrag) {
      setCustomSortEnteredViaDrag(false);
      return;
    }
    const pairs = computeFreezeOrderPairs(prevDisplayed);
    if (pairs.length === 0) return;

    // Synchronous, pre-paint cache write so the jumped order never paints.
    const orderById = new Map(pairs.map((p) => [p.id, p.day_order]));
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      old?.map((t) =>
        orderById.has(t.id)
          ? { ...t, day_order: orderById.get(t.id) as number }
          : t,
      ),
    );
    // Persist (guest path writes the mock store; onSettled refetch reconciles).
    reorderMutation.mutate(pairs);
  }, [
    sortBy,
    processedTasks,
    reorderMutation,
    queryClient,
    customSortEnteredViaDrag,
    setCustomSortEnteredViaDrag,
  ]);

  // Opens the edit sheet for a task selected from the global command menu.
  // Clears the id only once found — on first load from another page the
  // list may still be loading, and clearing early would drop the request.
  useEffect(() => {
    if (!selectedTaskId) return;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    setSelectedTask(task);
    setSelectedTaskId(null);
  }, [selectedTaskId, tasks, setSelectedTaskId]);

  const handleTaskClick = useCallback(
    (task: Task) => {
      (document.activeElement as HTMLElement)?.blur();
      if (onTaskSelect) {
        onTaskSelect(task);
      } else {
        setSelectedTask(task);
      }
    },
    [onTaskSelect],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      // Only synced on drag start — avoids expensive state syncing on every re-sort/re-group.
      setLocalActive(processedTasks.active);
      setLocalEvening(processedTasks.evening);
      setLocalGroups(processedTasks.groups);
      const id = event.active.id as string;
      setActiveId(id);
      setActiveTask(
        processedTasks.active.find((t) => t.id === id) ||
          processedTasks.evening.find((t) => t.id === id) ||
          processedTasks.groups
            ?.flatMap((g) => g.tasks)
            .find((t) => t.id === id) ||
          null,
      );
      // From processedTasks, not raw `tasks` — they can diverge (filtering,
      // tie-broken day_order) and corrupt the reorder math. Custom sort also
      // re-sorts to undo group-flattening's cross-group interleaving (mirrors TaskBoard.tsx).
      const visibleTasks = processedTasks.groups
        ? processedTasks.groups.flatMap((g) => g.tasks)
        : [...processedTasks.active, ...processedTasks.evening];
      preDragFlatTasksRef.current =
        sortBy === "custom"
          ? [...visibleTasks].sort((a, b) => a.day_order - b.day_order)
          : visibleTasks;
      triggerHaptic("toggle");
    },
    [processedTasks, triggerHaptic, sortBy],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      if (active.id === over.id) return;

      const activeContainer = active.data.current?.sortable?.containerId;
      const overContainer = over.data.current?.sortable?.containerId || over.id;

      if (!activeContainer || !overContainer) return;

      if (localGroups && localGroups.length > 0) {
        // --- Moving with Groups Active ---
        const activeGroupIndex = localGroups.findIndex(
          (g: TaskGroup) =>
            g.title === activeContainer ||
            g.tasks.some((t: Task) => t.id === active.id),
        );
        const overGroupIndex = localGroups.findIndex(
          (g: TaskGroup) =>
            g.title === overContainer ||
            g.tasks.some((t: Task) => t.id === over.id),
        );

        if (activeGroupIndex === -1 || overGroupIndex === -1) return;

        if (activeGroupIndex === overGroupIndex) {
          // Reorder within same group
          const group = localGroups[activeGroupIndex];
          const oldIndex = group.tasks.findIndex((t) => t.id === active.id);

          // dnd-kit's sortable index reflects DOM state; findIndex on React
          // state can be off-by-one during rapid drag-over events.
          let newIndex = over.data.current?.sortable?.index;
          if (newIndex === undefined) {
            newIndex = group.tasks.findIndex((t) => t.id === over.id);
          }

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newTasks = arrayMove(group.tasks, oldIndex, newIndex);
            const newGroups = [...localGroups];
            newGroups[activeGroupIndex] = { ...group, tasks: newTasks };
            setLocalGroups(newGroups);
          }
        } else {
          // Move between groups
          // Derived buckets like "Overdue" have no settable property — the
          // drop could never stick, so don't let the drag enter the group.
          if (isDropBlockedGroup(localGroups[overGroupIndex].title, groupBy)) {
            return;
          }
          setLocalGroups((prev) => {
            if (!prev) return prev;
            const newGroups = [...prev];
            const sourceGroup = { ...newGroups[activeGroupIndex] };
            const targetGroup = { ...newGroups[overGroupIndex] };

            const taskIndex = sourceGroup.tasks.findIndex(
              (t: Task) => t.id === active.id,
            );
            if (taskIndex === -1) return prev;

            const [task] = sourceGroup.tasks.splice(taskIndex, 1);
            const updates = getTaskUpdates(targetGroup.title);
            const updatedTask = { ...task, ...updates };

            let newIndex = over.data.current?.sortable?.index;
            if (newIndex === undefined) {
              const overIndex = targetGroup.tasks.findIndex(
                (t: Task) => t.id === over.id,
              );
              newIndex = overIndex >= 0 ? overIndex : targetGroup.tasks.length;
            } else {
              // Ensure index is valid, clamped to array bounds
              if (newIndex < 0) newIndex = targetGroup.tasks.length;
            }

            targetGroup.tasks.splice(newIndex, 0, updatedTask);

            newGroups[activeGroupIndex] = sourceGroup;
            newGroups[overGroupIndex] = targetGroup;
            return newGroups;
          });
        }
      } else {
        // --- Standard Active/Evening Moving ---
        if (activeContainer === overContainer) {
          // Moving within the same list
          const isEvening = activeContainer === "evening-section";
          const list = isEvening ? localEvening : localActive;
          const setList = isEvening ? setLocalEvening : setLocalActive;

          const oldIndex = list.findIndex((t: Task) => t.id === active.id);

          let newIndex = over.data.current?.sortable?.index;
          if (newIndex === undefined) {
            newIndex = list.findIndex((t: Task) => t.id === over.id);
          }

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            setList(arrayMove(list, oldIndex, newIndex));
          }
        } else {
          // Moving between lists (Active <-> Evening)
          const activeIsEvening = activeContainer === "evening-section";
          const overIsEvening = overContainer === "evening-section";

          const sourceList = activeIsEvening ? localEvening : localActive;
          const targetList = overIsEvening ? localEvening : localActive;
          const setSource = activeIsEvening ? setLocalEvening : setLocalActive;
          const setTarget = overIsEvening ? setLocalEvening : setLocalActive;

          const activeTask = sourceList.find((t: Task) => t.id === active.id);
          if (!activeTask) return;

          const dndKitIndex = over.data.current?.sortable?.index;
          let newIndex: number;

          if (dndKitIndex !== undefined) {
            newIndex = dndKitIndex >= 0 ? dndKitIndex : targetList.length;
          } else {
            const overIndex = targetList.findIndex(
              (t: Task) => t.id === over.id,
            );
            if (over.id in targetList) {
              newIndex = overIndex;
            } else {
              newIndex = overIndex >= 0 ? overIndex : targetList.length;
            }
          }

          setSource(sourceList.filter((t: Task) => t.id !== active.id));
          setTarget([
            ...targetList.slice(0, newIndex),
            { ...activeTask, is_evening: overIsEvening },
            ...targetList.slice(newIndex),
          ]);
        }
      }
    },
    [localActive, localEvening, localGroups, getTaskUpdates, groupBy],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Dropped outside any droppable — reset and exit. lockLocal(false) must
      // precede setActiveId(null) to avoid a render with stale localActive.
      if (!over) {
        setLockLocal(false);
        setLocalActive(processedTasks.active);
        setLocalEvening(processedTasks.evening);
        setLocalGroups(processedTasks.groups);
        setActiveId(null);
        setActiveTask(null);
        return;
      }

      if (localGroups && localGroups.length > 0) {
        const activeId = active.id as string;
        const finalGroup = localGroups.find((g: TaskGroup) =>
          g.tasks.some((t: Task) => t.id === activeId),
        );
        // Early-return BEFORE any state setters so we never leave the
        // component in a half-committed state (activeId=null, lockLocal=false).
        if (!finalGroup) {
          setActiveId(null);
          setActiveTask(null);
          return;
        }
        const activeTask = finalGroup.tasks.find(
          (t: Task) => t.id === activeId,
        );
        if (!activeTask) {
          setActiveId(null);
          setActiveTask(null);
          return;
        }

        const originalGroup = processedTasks.groups?.find((g: TaskGroup) =>
          g.tasks.some((t: Task) => t.id === activeId),
        );
        const isSameSection = originalGroup?.title === finalGroup.title;

        // CRITICAL: setLockLocal(true) must be queued before setActiveId(null)
        // — batching alone is fragile here (dnd-kit's dispatch + Compiler effect
        // reordering), and reversing this order can let displayTasks fall
        // through to a stale processedTasks.active. See dnd-residual-race-condition.md.
        setLockLocal(true);
        if (sortBy !== "custom") {
          setCustomSortEnteredViaDrag(true);
          setSortBy("custom");
        }

        // 1. Commit property updates (cross-group only)
        const updates = getTaskUpdates(finalGroup.title);
        const originalTask = tasks.find((t: Task) => t.id === activeId);

        const hasChanged =
          originalTask &&
          Object.keys(updates).some(
            (key) =>
              (updates as Record<string, unknown>)[key] !==
              (originalTask as unknown as Record<string, unknown>)[key],
          );

        // lockLocal releases only once ALL pending mutations settle — prevents
        // a cross-group snap-back if reorderMutation's refetch beats updateMutation's.
        let pendingCount = 0;
        const tryReleaseLock = () => {
          pendingCount--;
          if (pendingCount <= 0) setLockLocal(false);
        };

        if (hasChanged) {
          triggerHaptic("thud");
          pendingCount++;
          updateMutation.mutate(
            { id: activeId, ...updates },
            {
              onSettled: tryReleaseLock,
            },
          );
        }

        // 2. Commit the reorder: a single-task move if already in custom sort;
        // otherwise every other group's day_order is stale, so freeze the
        // entire post-drop order instead (localGroups already reflects the move).
        let pairs: { id: string; day_order: number }[];
        if (sortBy === "custom") {
          const orderedIds = finalGroup.tasks.map((t: Task) => t.id);
          pairs = computeReorderPairs(
            activeId,
            orderedIds,
            preDragFlatTasksRef.current,
            isSameSection,
          );
        } else {
          pairs = computeFreezeOrderPairs(localGroups.flatMap((g) => g.tasks));
        }
        if (pairs.length > 0) {
          pendingCount++;
          reorderMutation.mutate(pairs, {
            onSettled: tryReleaseLock,
          });
        }
        // Nothing to persist — release the lock now; onSettled never fires.
        if (pendingCount === 0) {
          setLockLocal(false);
        }
        triggerHaptic("thud");
        setActiveId(null);
        setActiveTask(null);
      } else {
        const findTaskInLocal = (id: string) =>
          localActive.find((t: Task) => t.id === id) ||
          localEvening.find((t: Task) => t.id === id);

        const activeTask = findTaskInLocal(active.id as string);
        if (!activeTask) {
          setActiveId(null);
          setActiveTask(null);
          return;
        }

        // CRITICAL ORDERING: lockLocal BEFORE activeId — see comment above.
        setLockLocal(true);
        if (sortBy !== "custom") {
          setCustomSortEnteredViaDrag(true);
          setSortBy("custom");
        }

        // Check if it's now in evening vs active
        const isInEveningNow = localEvening.some(
          (t: Task) => t.id === active.id,
        );
        const wasInEveningBefore = processedTasks.evening.some(
          (t: Task) => t.id === active.id,
        );
        const isSameSection = isInEveningNow === wasInEveningBefore;

        // Same pending-count guard as the groups branch above.
        let pendingCount = 0;
        const tryReleaseLock = () => {
          pendingCount--;
          if (pendingCount <= 0) setLockLocal(false);
        };

        if (isInEveningNow !== wasInEveningBefore) {
          triggerHaptic("thud");
          pendingCount++;
          updateMutation.mutate(
            {
              id: activeTask.id,
              is_evening: isInEveningNow,
            },
            {
              onSettled: tryReleaseLock,
            },
          );
        }

        // Commit the reorder: single-task move if already custom-sorted;
        // otherwise freeze the full post-drop order so untouched sections (e.g. evening) don't jump.
        triggerHaptic("thud");
        let pairs: { id: string; day_order: number }[];
        if (sortBy === "custom") {
          const currentList = isInEveningNow ? localEvening : localActive;
          const orderedIds = currentList.map((t: Task) => t.id);
          pairs = computeReorderPairs(
            activeTask.id,
            orderedIds,
            preDragFlatTasksRef.current,
            isSameSection,
          );
        } else {
          pairs = computeFreezeOrderPairs([...localActive, ...localEvening]);
        }
        if (pairs.length > 0) {
          pendingCount++;
          reorderMutation.mutate(pairs, {
            onSettled: tryReleaseLock,
          });
        }
        // Nothing to persist — release the lock now; onSettled never fires.
        if (pendingCount === 0) {
          setLockLocal(false);
        }
        setActiveId(null);
        setActiveTask(null);
      }
    },
    [
      processedTasks.active,
      processedTasks.evening,
      processedTasks.groups,
      localActive,
      localEvening,
      localGroups,
      triggerHaptic,
      updateMutation,
      sortBy,
      setSortBy,
      setCustomSortEnteredViaDrag,
      reorderMutation,
      tasks,
      getTaskUpdates,
    ],
  );

  const navigableTasks = useMemo(() => {
    const list: Task[] = [];
    if (processedTasks?.groups) {
      processedTasks.groups.forEach((g) => list.push(...g.tasks));
    } else {
      list.push(...(processedTasks?.active || []));
    }
    list.push(...(processedTasks?.evening || []));
    list.push(...(processedTasks?.completed || []));
    return list;
  }, [processedTasks]);

  const handleNav = (direction: 1 | -1) => {
    if (navigableTasks.length === 0) return;
    const currentIndex = navigableTasks.findIndex(
      (t) => t.id === keyboardSelectedId,
    );
    if (currentIndex === -1) {
      setKeyboardSelectedId(navigableTasks[0].id);
      return;
    }
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < navigableTasks.length) {
      setKeyboardSelectedId(navigableTasks[nextIndex].id);
    }
  };

  useHotkeys("j", () => handleNav(1), { preventDefault: true });
  useHotkeys("k", () => handleNav(-1), { preventDefault: true });
  useHotkeys("space", (e) => {
    e.preventDefault();
    if (keyboardSelectedId) {
      const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
      if (task) {
        toggleMutation.mutate({
          id: task.id,
          is_completed: !task.is_completed,
        });
      }
    }
  });

  useHotkeys(
    ["enter", "e"],
    () => {
      if (keyboardSelectedId) {
        const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
        if (task) setSelectedTask(task);
      }
    },
    { preventDefault: true },
  );

  useHotkeys(["d", "backspace"], () => {
    if (keyboardSelectedId) {
      deleteMutation.mutate(keyboardSelectedId);
      handleNav(1);
    }
  });

  const overlayContent = useMemo(() => {
    if (!activeTask) return null;
    const project = projectsMap.get(activeTask.project_id || "inbox");

    return (
      <div className="opacity-90 pointer-events-none will-change-transform rotate-1 scale-[1.02]">
        <TaskGhost
          task={activeTask}
          isDesktop={isDesktop}
          viewMode="list"
          project={project}
        />
      </div>
    );
  }, [activeTask, projectsMap, isDesktop]);

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-4">
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 md:h-8 md:border-b md:border-border/40 rounded-xl md:rounded-sm mx-2 md:mx-0 mb-2 md:mb-0 bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (
    processedTasks.active.length === 0 &&
    processedTasks.completed.length === 0
  ) {
    return (
      <div className="px-4 md:px-6">
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Focus on what matters. Create your first task to start your journey."
          action={{
            label: "Create Task",
            onClick: () => {
              triggerHaptic("toggle");
              openAddTask();
            },
            icon: Plus,
          }}
        />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        // rectIntersection can resolve to the whole column instead of an item
        // within it for stacked droppables — closestCorners avoids that.
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements: dndAnnouncements }}
        // WhileDragging avoids Always's idle re-measure overhead, which hurts cross-column drags.
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
          canScroll: canScrollTaskListContainer,
        }}
      >
        <div
          data-task-list-scroll-container="true"
          className="flex-1 h-full overflow-y-auto scrollbar-hide relative overscroll-contain"
          style={{ contain: "strict" }}
        >
          {viewMode === "board" && isDesktop ? (
            <TaskBoard
              processedTasks={processedTasks}
              projectsMap={projectsMap}
              onSelect={handleTaskClick}
              isDesktop={isDesktop}
              triggerHaptic={triggerHaptic}
              setActiveTaskId={setActiveTaskId}
            />
          ) : (
            <TaskListView
              processedTasks={processedTasks}
              activeTasks={displayTasks}
              eveningTasks={displayEveningTasks}
              groupTasks={displayGroups}
              handleTaskClick={handleTaskClick}
              keyboardSelectedId={keyboardSelectedId}
              isDndActive={!!activeId}
              projectsMap={projectsMap}
              isDesktop={isDesktop}
              triggerHaptic={triggerHaptic}
              setActiveTaskId={setActiveTaskId}
            />
          )}
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay
              dropAnimation={{
                duration: 0,
                sideEffects: defaultDropAnimationSideEffects({
                  styles: {
                    active: { opacity: "0.5" },
                  },
                }),
              }}
            >
              {overlayContent}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      <TaskSheet
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        initialTask={selectedTask}
      />
    </>
  );
}

const TaskList = memo(TaskListBase);
export default TaskList;
