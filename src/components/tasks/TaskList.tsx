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
  useDuplicateTask,
} from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useIsAnyModalOpen } from "@/lib/hooks/useIsAnyModalOpen";
import { useHotkeys } from "react-hotkeys-hook";
import { useTaskViewData, getBoardColumns } from "@/lib/hooks/useTaskViewData";
import { TaskListView } from "./TaskListView";
import { TaskBoard } from "./TaskBoard";
import { TaskGhost } from "./TaskGhost";
import { useTimerStore } from "@/lib/store/timerStore";
import { taskDomId } from "./task-utils";

// dnd-kit announces on every onDragOver by default, thrashing aria-live at
// drag-over frequency — no-op it and keep only start/end/cancel announcements.
const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

const VIM_DOUBLE_PRESS_TIMEOUT_MS = 500;

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
  // Snapshotted at drag start for the ghost — deriving it per render would
  // flatMap+find over every task on each drag-over.
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // Holds local drag state after activeId clears, until the optimistic
  // cache update lands.
  const [lockLocal, setLockLocal] = useState(false);
  const [keyboardSelectedId, setKeyboardSelectedId] = useState<string | null>(
    null,
  );
  // keyboardSelectedId is virtual focus — DOM focus never moves to a card.
  // Exposed via aria-activedescendant (role listbox/grid below), not roving
  // tabindex, since focusing cards would re-arm dnd-kit's Space/Enter drag
  // collision (see the DragHandle split in SortableBoardTaskCard).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Tracks the single most recent double-press candidate (gg / yy) so an
  // interleaved different key (e.g. `g` then `y`) can't be mistaken for
  // that key's own double-press.
  const pendingDoublePressRef = useRef<{
    key: "g" | "y";
    timestamp: number;
  } | null>(null);

  const queryClient = useQueryClient();
  const reorderMutation = useReorderTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const toggleMutation = useToggleTask();
  const duplicateMutation = useDuplicateTask();
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
  const hasYankedTask = useUiStore((state) => !!state.yankedTaskId);
  const { openAddTask } = useTaskActions();
  const { trigger: triggerHaptic } = useHaptic();
  const setActiveTaskId = useTimerStore((state) => state.setActiveTaskId);

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

  // Freezes the pre-switch order into day_order when switching to custom sort,
  // which is otherwise stale and visibly jumps. Reads prevDisplayedFlatRef
  // rather than the already-resorted processedTasks, in useLayoutEffect so the
  // first paint is correct. Drag-driven switches bake their own order.
  const prevSortByRef = useRef(sortBy);
  const prevDisplayedFlatRef = useRef<Task[]>([]);
  useLayoutEffect(() => {
    const prevSortBy = prevSortByRef.current;
    prevSortByRef.current = sortBy;

    // Read the snapshot from the old sort, then refresh it for next time.
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

  // Opens the edit sheet for a task picked in the command menu. Clears the id
  // only once found — the list may still be loading on first navigation.
  useEffect(() => {
    if (!selectedTaskId) return;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    handleTaskClick(task);
    setSelectedTaskId(null);
  }, [selectedTaskId, tasks, setSelectedTaskId, handleTaskClick]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      // Synced on drag start only — otherwise every re-sort/re-group pays.
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
      // From processedTasks, not raw `tasks` — filtering and tie-broken
      // day_order make them diverge and corrupt the reorder math.
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
          const group = localGroups[activeGroupIndex];
          const oldIndex = group.tasks.findIndex((t) => t.id === active.id);

          // findIndex on React state can be off-by-one during rapid drag-over.
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
              if (newIndex < 0) newIndex = targetGroup.tasks.length;
            }

            targetGroup.tasks.splice(newIndex, 0, updatedTask);

            newGroups[activeGroupIndex] = sourceGroup;
            newGroups[overGroupIndex] = targetGroup;
            return newGroups;
          });
        }
      } else {
        if (activeContainer === overContainer) {
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
        // Return before any setter, or we land half-committed.
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

        // Must precede setActiveId(null) — reversing it lets displayTasks fall
        // through to stale server data. See dnd-residual-race-condition.md.
        setLockLocal(true);
        if (sortBy !== "custom") {
          setCustomSortEnteredViaDrag(true);
          setSortBy("custom");
        }

        const updates = getTaskUpdates(finalGroup.title);
        const originalTask = tasks.find((t: Task) => t.id === activeId);

        const hasChanged =
          originalTask &&
          Object.keys(updates).some(
            (key) =>
              (updates as Record<string, unknown>)[key] !==
              (originalTask as unknown as Record<string, unknown>)[key],
          );

        // Releases only once all mutations settle — otherwise reorder's refetch
        // can beat update's and snap the task back.
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

        // Single-task move in custom sort; otherwise every other group's
        // day_order is stale, so freeze the whole post-drop order.
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

        // lockLocal must precede activeId — see the reset branch above.
        setLockLocal(true);
        if (sortBy !== "custom") {
          setCustomSortEnteredViaDrag(true);
          setSortBy("custom");
        }

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

        // Single-task move in custom sort; otherwise freeze the full order so
        // untouched sections don't jump.
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

  const isAnyModalOpen = useIsAnyModalOpen() || !!selectedTask;

  const boardColumns = useMemo<TaskGroup[]>(
    () => getBoardColumns(processedTasks),
    [processedTasks],
  );

  const handleListNav = (direction: 1 | -1) => {
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

  const handleBoardNav = (dirX: number, dirY: number) => {
    const totalBoardTasks = boardColumns.reduce(
      (acc, col) => acc + col.tasks.length,
      0,
    );
    if (totalBoardTasks === 0) return;

    let currentColIndex = -1;
    let currentRowIndex = -1;

    if (keyboardSelectedId) {
      for (let c = 0; c < boardColumns.length; c++) {
        const r = boardColumns[c].tasks.findIndex(
          (t) => t.id === keyboardSelectedId,
        );
        if (r !== -1) {
          currentColIndex = c;
          currentRowIndex = r;
          break;
        }
      }
    }

    if (currentColIndex === -1 || currentRowIndex === -1) {
      const firstNonEmptyCol = boardColumns.find((c) => c.tasks.length > 0);
      if (firstNonEmptyCol && firstNonEmptyCol.tasks.length > 0) {
        setKeyboardSelectedId(firstNonEmptyCol.tasks[0].id);
      }
      return;
    }

    if (dirY !== 0) {
      const col = boardColumns[currentColIndex];
      const nextRow = currentRowIndex + dirY;
      if (nextRow >= 0 && nextRow < col.tasks.length) {
        setKeyboardSelectedId(col.tasks[nextRow].id);
      }
    } else if (dirX !== 0) {
      let targetColIndex = currentColIndex + dirX;
      while (
        targetColIndex >= 0 &&
        targetColIndex < boardColumns.length &&
        boardColumns[targetColIndex].tasks.length === 0
      ) {
        targetColIndex += dirX;
      }
      if (
        targetColIndex >= 0 &&
        targetColIndex < boardColumns.length &&
        boardColumns[targetColIndex].tasks.length > 0
      ) {
        const targetCol = boardColumns[targetColIndex];
        const targetRowIndex = Math.min(
          currentRowIndex,
          targetCol.tasks.length - 1,
        );
        setKeyboardSelectedId(targetCol.tasks[targetRowIndex].id);
      }
    }
  };

  const clearPendingDoublePress = () => {
    pendingDoublePressRef.current = null;
  };

  // Shared "press the same key twice within the timeout" detection behind
  // `gg` and `yy`.
  const handleDoublePress = (key: "g" | "y", onDouble: () => void) => {
    const pending = pendingDoublePressRef.current;
    const now = Date.now();
    if (
      pending &&
      pending.key === key &&
      now - pending.timestamp < VIM_DOUBLE_PRESS_TIMEOUT_MS
    ) {
      clearPendingDoublePress();
      onDouble();
    } else {
      pendingDoublePressRef.current = { key, timestamp: now };
    }
  };

  const handleNavVertical = (dir: 1 | -1) => {
    clearPendingDoublePress();
    if (viewMode === "board") {
      handleBoardNav(0, dir);
    } else {
      handleListNav(dir);
    }
  };

  const handleNavHorizontal = (dir: 1 | -1) => {
    clearPendingDoublePress();
    if (viewMode === "board") {
      handleBoardNav(dir, 0);
    }
  };

  const getExtremeTask = (position: "first" | "last"): Task | undefined => {
    if (viewMode === "board") {
      const cols =
        position === "first" ? boardColumns : [...boardColumns].reverse();
      const targetCol = cols.find((c) => c.tasks.length > 0);
      if (!targetCol || targetCol.tasks.length === 0) return undefined;
      return position === "first"
        ? targetCol.tasks[0]
        : targetCol.tasks[targetCol.tasks.length - 1];
    }
    if (navigableTasks.length === 0) return undefined;
    return position === "first"
      ? navigableTasks[0]
      : navigableTasks[navigableTasks.length - 1];
  };

  const handleNavTop = () => {
    const task = getExtremeTask("first");
    if (task) setKeyboardSelectedId(task.id);
  };

  const handleNavBottom = () => {
    clearPendingDoublePress();
    const task = getExtremeTask("last");
    if (task) setKeyboardSelectedId(task.id);
  };

  const hasSelection = !!keyboardSelectedId;

  // aria-activedescendant is inert unless the owning container has DOM
  // focus, so arm it the moment vim nav picks a task. Cheap to call again
  // on every selection change — an already-focused element is a no-op.
  useEffect(() => {
    if (hasSelection) {
      scrollContainerRef.current?.focus({ preventScroll: true });
    }
  }, [hasSelection]);

  // Vim keys have no native behaviour worth preserving, so they always claim
  // the keypress. Arrow keys/space drive page scroll until a task is
  // selected, so they only claim the key once vim mode is armed.
  const hotkeyOptions = {
    preventDefault: true,
    enabled: !isAnyModalOpen,
  };
  const arrowHotkeyOptions = {
    preventDefault: hasSelection,
    enabled: !isAnyModalOpen,
  };

  useHotkeys("j", () => handleNavVertical(1), hotkeyOptions);
  useHotkeys("arrowdown", () => handleNavVertical(1), arrowHotkeyOptions);
  useHotkeys("k", () => handleNavVertical(-1), hotkeyOptions);
  useHotkeys("arrowup", () => handleNavVertical(-1), arrowHotkeyOptions);
  useHotkeys("l", () => handleNavHorizontal(1), hotkeyOptions);
  useHotkeys("arrowright", () => handleNavHorizontal(1), arrowHotkeyOptions);
  useHotkeys("h", () => handleNavHorizontal(-1), hotkeyOptions);
  useHotkeys("arrowleft", () => handleNavHorizontal(-1), arrowHotkeyOptions);
  useHotkeys(
    "g",
    (e) => {
      if (e.shiftKey) return;
      handleDoublePress("g", handleNavTop);
    },
    hotkeyOptions,
  );
  useHotkeys(
    ["shift+g", "G"],
    (e) => {
      if (!e.shiftKey) return;
      handleNavBottom();
    },
    hotkeyOptions,
  );

  const toggleSelected = () => {
    clearPendingDoublePress();
    if (keyboardSelectedId) {
      const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
      if (task) {
        toggleMutation.mutate({
          id: task.id,
          is_completed: !task.is_completed,
        });
      }
    }
  };

  useHotkeys("x", toggleSelected, hotkeyOptions);
  useHotkeys(
    "space",
    (e) => {
      if (keyboardSelectedId) {
        e.preventDefault();
        toggleSelected();
      }
    },
    arrowHotkeyOptions,
  );

  useHotkeys(
    ["enter", "o"],
    () => {
      clearPendingDoublePress();
      if (keyboardSelectedId) {
        const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
        if (task) handleTaskClick(task);
      }
    },
    hotkeyOptions,
  );

  useHotkeys(
    ["d", "backspace"],
    () => {
      clearPendingDoublePress();
      if (keyboardSelectedId) {
        const deletedId = keyboardSelectedId;
        handleNavVertical(1);
        deleteMutation.mutate(deletedId);
      }
    },
    hotkeyOptions,
  );

  useHotkeys(
    "u",
    () => {
      clearPendingDoublePress();
      const triggerLastUndoAction = useUiStore.getState().triggerLastUndoAction;
      void triggerLastUndoAction();
    },
    hotkeyOptions,
  );

  useHotkeys(
    "y",
    (e) => {
      if (e.shiftKey) return;
      handleDoublePress("y", () => {
        if (keyboardSelectedId) {
          const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
          if (task) {
            useUiStore.getState().setYankedTaskId(task.id);
            triggerHaptic("toggle");
            notify("Task yanked");
          }
        }
      });
    },
    hotkeyOptions,
  );

  useHotkeys(
    "p",
    (e) => {
      clearPendingDoublePress();
      const yankedTaskId = useUiStore.getState().yankedTaskId;
      if (!yankedTaskId) return;
      // Resolved fresh from the query cache rather than a store snapshot —
      // the task may have been edited since it was yanked. Falls through to
      // every ["tasks", ...] query, not just this view's own `tasks` — the
      // yank is meant to survive project/filter switches, and the task may
      // now live in a view this TaskList instance isn't currently showing.
      const yankedTask =
        tasks.find((t) => t.id === yankedTaskId) ??
        queryClient
          .getQueriesData<Task[]>({ queryKey: ["tasks"] })
          .flatMap(([, data]) => data ?? [])
          .find((t) => t.id === yankedTaskId);
      if (!yankedTask) {
        useUiStore.getState().setYankedTaskId(null);
        notify.error("Yanked task no longer exists");
        return;
      }
      e.preventDefault();
      duplicateMutation.mutate(yankedTask, {
        onSuccess: (newDuplicateTask) => {
          if (newDuplicateTask?.id) {
            setKeyboardSelectedId(newDuplicateTask.id);
          }
        },
      });
    },
    hotkeyOptions,
  );

  useHotkeys(
    "escape",
    () => {
      clearPendingDoublePress();
      setKeyboardSelectedId(null);
      // Release the yanked task too — otherwise it survives Escape and
      // keeps suppressing GlobalHotkeys' New Project 'p' on this page
      // (see GlobalHotkeys.tsx) until a hard reload clears the store.
      if (hasYankedTask) useUiStore.getState().setYankedTaskId(null);
    },
    {
      enabled: !isAnyModalOpen && (hasSelection || hasYankedTask),
    },
  );

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
          ref={scrollContainerRef}
          data-task-list-scroll-container="true"
          role={viewMode === "board" ? "grid" : "listbox"}
          aria-label={viewMode === "board" ? "Task board" : "Task list"}
          tabIndex={0}
          aria-activedescendant={
            keyboardSelectedId ? taskDomId(keyboardSelectedId) : undefined
          }
          className="flex-1 h-full overflow-y-auto scrollbar-hide relative overscroll-contain focus-visible:outline-none"
          style={{ contain: "strict" }}
        >
          {viewMode === "board" ? (
            <TaskBoard
              processedTasks={processedTasks}
              projectsMap={projectsMap}
              onSelect={handleTaskClick}
              isDesktop={isDesktop}
              triggerHaptic={triggerHaptic}
              setActiveTaskId={setActiveTaskId}
              // Omitting this drops getTaskUpdatesForGroup to its heuristic
              // cascade, where a project named "Today" reads as a date.
              groupBy={groupBy}
              keyboardSelectedId={keyboardSelectedId}
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
