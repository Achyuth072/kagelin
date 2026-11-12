"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Task, Project } from "@/lib/types/task";
import type {
  TaskGroup,
  TaskPresentation,
  UseTaskDndOptions,
  UseTaskDndReturn,
} from "@/lib/types/task-view";
import {
  computeFreezeOrderPairs,
  computeReorderPairs,
  getTaskUpdatesForGroup,
  isDropBlockedGroup,
  type TaskPlacement,
} from "@/lib/utils/task-dnd";
import { useReorderTasks, useUpdateTask } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { taskDomId } from "./task-utils";

const EMPTY_MAP = new Map<string, Project>();

const isEveningContainer = (id?: string) =>
  id === "evening-section" || id === "This Evening" || id === "this evening";

const isActiveContainer = (id?: string) =>
  id === "active-section" ||
  id === "Tasks" ||
  id === "tasks" ||
  id === "active";

const resolveTargetIndex = (
  tasks: Task[],
  targetId: string,
  dndKitIndex?: number,
): number => {
  if (dndKitIndex !== undefined && dndKitIndex >= 0) return dndKitIndex;
  const index = tasks.findIndex((t) => t.id === targetId);
  return index >= 0 ? index : tasks.length;
};

export function useTaskDnd({
  presentation,
  tasks = [],
  projectsMap = EMPTY_MAP,
  groupBy = "none",
  sortBy = "custom",
  isDesktop: isDesktopProp,
}: UseTaskDndOptions): UseTaskDndReturn {
  const isDesktopStore = useUiStore((state) => state.isDesktop);
  const isDesktop = isDesktopProp ?? isDesktopStore;
  const setSortBy = useUiStore((state) => state.setSortBy);
  const setCustomSortEnteredViaDrag = useUiStore(
    (state) => state.setCustomSortEnteredViaDrag,
  );

  const updateMutation = useUpdateTask();
  const reorderMutation = useReorderTasks();
  const { trigger: triggerHaptic } = useHaptic();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [lockLocal, setLockLocal] = useState(false);

  const [localActive, setLocalActive] = useState<Task[]>(presentation.active);
  const [localEvening, setLocalEvening] = useState<Task[]>(
    presentation.evening,
  );
  const [localGroups, setLocalGroups] = useState<TaskGroup[] | null>(
    presentation.groups,
  );

  const preDragFlatTasksRef = useRef<Task[]>([]);

  const displayPresentation = useMemo<TaskPresentation>(() => {
    if (activeId || lockLocal) {
      return {
        active: localActive,
        evening: localEvening,
        groups: localGroups,
        completed: presentation.completed,
      };
    }
    return presentation;
  }, [
    activeId,
    lockLocal,
    localActive,
    localEvening,
    localGroups,
    presentation,
  ]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: isDesktop
      ? { distance: 5 }
      : { delay: 250, tolerance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 300, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const getTaskUpdates = useCallback(
    (groupTitle: string) =>
      getTaskUpdatesForGroup(groupTitle, projectsMap, groupBy),
    [projectsMap, groupBy],
  );

  const clearActiveDrag = useCallback(() => {
    setActiveId(null);
    setActiveTask(null);
    setActiveWidth(null);
  }, []);

  const resetDragState = useCallback(() => {
    setLockLocal(false);
    setLocalActive(presentation.active);
    setLocalEvening(presentation.evening);
    setLocalGroups(presentation.groups);
    clearActiveDrag();
  }, [presentation, clearActiveDrag]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setLocalActive([...presentation.active]);
      setLocalEvening([...presentation.evening]);
      setLocalGroups(
        presentation.groups?.map((g) => ({ ...g, tasks: [...g.tasks] })) ??
          null,
      );

      const id = String(event.active.id);
      setActiveId(id);

      const initialWidth =
        event.active.rect?.current?.initial?.width ??
        (typeof document !== "undefined"
          ? (document.getElementById(taskDomId(id))?.getBoundingClientRect()
              .width ?? null)
          : null);
      setActiveWidth(initialWidth);

      const visibleTasks = presentation.groups
        ? presentation.groups.flatMap((g) => g.tasks)
        : [...presentation.active, ...presentation.evening];

      const foundTask = visibleTasks.find((t) => t.id === id) ?? null;
      setActiveTask(foundTask);

      preDragFlatTasksRef.current =
        sortBy === "custom"
          ? [...visibleTasks].sort((a, b) => a.day_order - b.day_order)
          : visibleTasks;

      if (!isDesktop) {
        triggerHaptic("toggle");
      }
    },
    [presentation, sortBy, isDesktop, triggerHaptic],
  );

  const handleDragOver = useCallback(
    (event: {
      active: {
        id: unknown;
        data?: {
          current?: { sortable?: { containerId?: string; index?: number } };
        };
      };
      over: {
        id: unknown;
        data?: {
          current?: { sortable?: { containerId?: string; index?: number } };
        };
      } | null;
    }) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      if (localGroups && localGroups.length > 0) {
        const activeContainer = active.data?.current?.sortable?.containerId;
        const overContainer =
          over.data?.current?.sortable?.containerId || overIdStr;

        const activeGroupIndex = localGroups.findIndex(
          (g) =>
            g.tasks.some((t) => t.id === activeIdStr) ||
            (activeContainer && g.title === activeContainer),
        );
        const overGroupIndex = localGroups.findIndex(
          (g) =>
            g.tasks.some((t) => t.id === overIdStr) ||
            g.title === overIdStr ||
            (overContainer && g.title === overContainer),
        );

        if (activeGroupIndex === -1 || overGroupIndex === -1) return;

        const overSortableIndex =
          over.data?.current?.sortable?.containerId === "grouped-tasks"
            ? undefined
            : over.data?.current?.sortable?.index;

        if (activeGroupIndex === overGroupIndex) {
          const group = localGroups[activeGroupIndex];
          const oldIndex = group.tasks.findIndex((t) => t.id === activeIdStr);
          const newIndex = resolveTargetIndex(
            group.tasks,
            overIdStr,
            overSortableIndex,
          );

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newTasks = arrayMove([...group.tasks], oldIndex, newIndex);
            const newGroups = [...localGroups];
            newGroups[activeGroupIndex] = { ...group, tasks: newTasks };
            setLocalGroups(newGroups);
          }
        } else {
          if (isDropBlockedGroup(localGroups[overGroupIndex].title, groupBy)) {
            return;
          }

          const sourceGroup = localGroups[activeGroupIndex];
          const targetGroup = localGroups[overGroupIndex];
          const activeTasks = [...sourceGroup.tasks];
          const overTasks = [...targetGroup.tasks];

          const taskIndex = activeTasks.findIndex((t) => t.id === activeIdStr);
          if (taskIndex === -1) return;

          const [task] = activeTasks.splice(taskIndex, 1);
          const updates = getTaskUpdates(targetGroup.title);
          const updatedTask = { ...task, ...updates };

          const newIndex = resolveTargetIndex(
            overTasks,
            overIdStr,
            overSortableIndex,
          );
          overTasks.splice(newIndex, 0, updatedTask);

          const newGroups = [...localGroups];
          newGroups[activeGroupIndex] = { ...sourceGroup, tasks: activeTasks };
          newGroups[overGroupIndex] = { ...targetGroup, tasks: overTasks };
          setLocalGroups(newGroups);
        }
      } else {
        const activeContainer = active.data?.current?.sortable?.containerId;
        const overContainer = over.data?.current?.sortable?.containerId;

        const activeIsEvening =
          isEveningContainer(activeContainer) ||
          localEvening.some((t) => t.id === activeIdStr);

        let overIsEvening = activeIsEvening;
        if (
          isEveningContainer(overIdStr) ||
          isEveningContainer(overContainer) ||
          localEvening.some((t) => t.id === overIdStr)
        ) {
          overIsEvening = true;
        } else if (
          isActiveContainer(overIdStr) ||
          isActiveContainer(overContainer) ||
          localActive.some((t) => t.id === overIdStr)
        ) {
          overIsEvening = false;
        }

        if (activeIsEvening === overIsEvening) {
          const list = activeIsEvening ? localEvening : localActive;
          const setList = activeIsEvening ? setLocalEvening : setLocalActive;

          const oldIndex = list.findIndex((t) => t.id === activeIdStr);
          const newIndex = resolveTargetIndex(
            list,
            overIdStr,
            over.data?.current?.sortable?.index,
          );

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            setList(arrayMove(list, oldIndex, newIndex));
          }
        } else {
          const sourceList = activeIsEvening ? localEvening : localActive;
          const targetList = overIsEvening ? localEvening : localActive;
          const setSource = activeIsEvening ? setLocalEvening : setLocalActive;
          const setTarget = overIsEvening ? setLocalEvening : setLocalActive;

          const targetTask = sourceList.find((t) => t.id === activeIdStr);
          if (!targetTask) return;

          const newIndex = resolveTargetIndex(
            targetList,
            overIdStr,
            over.data?.current?.sortable?.index,
          );

          setSource(sourceList.filter((t) => t.id !== activeIdStr));
          setTarget([
            ...targetList.slice(0, newIndex),
            { ...targetTask, is_evening: overIsEvening },
            ...targetList.slice(newIndex),
          ]);
        }
      }
    },
    [localGroups, localActive, localEvening, groupBy, getTaskUpdates],
  );

  const handleDragEnd = useCallback(
    (event: { active: { id: unknown }; over: { id: unknown } | null }) => {
      const { active, over } = event;

      if (!over) {
        resetDragState();
        return;
      }

      const activeIdStr = String(active.id);

      const commitDrop = (
        taskId: string,
        updates: TaskPlacement,
        hasFieldChanges: boolean,
        orderedIds: string[],
        allVisibleTasks: Task[],
        isSameSection: boolean,
      ) => {
        setLockLocal(true);
        if (sortBy !== "custom") {
          setCustomSortEnteredViaDrag(true);
          setSortBy("custom");
        }

        let pendingCount = 0;
        const tryReleaseLock = () => {
          pendingCount--;
          if (pendingCount <= 0) {
            setLockLocal(false);
          }
        };

        if (hasFieldChanges) {
          pendingCount++;
          updateMutation.mutate(
            { id: taskId, ...updates },
            { onSettled: tryReleaseLock },
          );
        }

        const pairs =
          sortBy === "custom"
            ? computeReorderPairs(
                taskId,
                orderedIds,
                preDragFlatTasksRef.current,
                isSameSection,
              )
            : computeFreezeOrderPairs(allVisibleTasks);

        if (pairs.length > 0) {
          pendingCount++;
          reorderMutation.mutate(pairs, { onSettled: tryReleaseLock });
        }

        if (pendingCount === 0) {
          setLockLocal(false);
        }

        if (!isDesktop) {
          triggerHaptic("thud");
        }

        clearActiveDrag();
      };

      if (localGroups && localGroups.length > 0) {
        const finalGroup = localGroups.find((g) =>
          g.tasks.some((t) => t.id === activeIdStr),
        );
        if (!finalGroup) {
          clearActiveDrag();
          return;
        }

        const originalGroup = presentation.groups?.find((g) =>
          g.tasks.some((t) => t.id === activeIdStr),
        );
        const isSameSection = originalGroup?.title === finalGroup.title;

        const updates = getTaskUpdates(finalGroup.title);
        const originalTask =
          tasks.find((t) => t.id === activeIdStr) ??
          preDragFlatTasksRef.current.find((t) => t.id === activeIdStr);

        const hasChanged = originalTask
          ? Object.keys(updates).some(
              (key) =>
                (updates as Record<string, unknown>)[key] !==
                (originalTask as unknown as Record<string, unknown>)[key],
            )
          : false;

        commitDrop(
          activeIdStr,
          updates,
          hasChanged,
          finalGroup.tasks.map((t) => t.id),
          localGroups.flatMap((g) => g.tasks),
          isSameSection,
        );
      } else {
        const isInEveningNow = localEvening.some((t) => t.id === activeIdStr);
        const wasInEveningBefore = presentation.evening.some(
          (t) => t.id === activeIdStr,
        );
        const isSameSection = isInEveningNow === wasInEveningBefore;

        const draggedTask =
          localActive.find((t) => t.id === activeIdStr) ??
          localEvening.find((t) => t.id === activeIdStr);

        if (!draggedTask) {
          clearActiveDrag();
          return;
        }

        const hasChanged = isInEveningNow !== wasInEveningBefore;
        const currentList = isInEveningNow ? localEvening : localActive;

        commitDrop(
          draggedTask.id,
          hasChanged ? { is_evening: isInEveningNow } : {},
          hasChanged,
          currentList.map((t) => t.id),
          [...localActive, ...localEvening],
          isSameSection,
        );
      }
    },
    [
      presentation,
      localGroups,
      localActive,
      localEvening,
      resetDragState,
      clearActiveDrag,
      sortBy,
      tasks,
      getTaskUpdates,
      updateMutation,
      reorderMutation,
      isDesktop,
      triggerHaptic,
      setCustomSortEnteredViaDrag,
      setSortBy,
    ],
  );

  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  return {
    activeTask,
    activeId,
    activeWidth,
    displayPresentation,
    isDragging: !!activeId,
    sensors,
    collisionDetection: closestCorners,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  };
}
