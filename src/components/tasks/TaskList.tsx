"use client";

import { CheckSquare, Plus } from "lucide-react";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  memo,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  DragOverlay,
  defaultDropAnimationSideEffects,
  defaultAnnouncements,
  DndContext,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import TaskSheet from "./TaskSheet";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { Task, Project } from "@/lib/types/task";
import type { SortOption, GroupOption } from "@/lib/types/sorting";
import type { TaskGroup } from "@/lib/hooks/useTaskViewData";
import {
  getPasteOverrides,
  computeFreezeOrderPairs,
} from "@/lib/utils/task-dnd";
import { useTaskDnd } from "./useTaskDnd";
import {
  useReorderTasks,
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
import {
  taskDomId,
  focusTextareaToEnd,
  TASK_TITLE_EDIT_ID,
} from "./task-utils";

// Suppress onDragOver announcements to prevent aria-live thrashing.
const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

const VIM_DOUBLE_PRESS_TIMEOUT_MS = 500;

const DISMISS_IGNORE_SELECTOR = [
  '[data-testid="docked-task-inspector"]',
  '[data-testid="board-overlay-drawer"]',
  '[data-task-inspector="true"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[data-radix-portal] [role="listbox"]',
  '[role="tooltip"]',
  '[role="alertdialog"]',
  "[data-radix-portal]",
  "[data-radix-popper-content-wrapper]",
  ".toaster",
  "[data-sonner-toaster]",
  '[role="tab"]',
  '[data-testid="view-mode-tabs"]',
  '[data-testid="board-inspect-mode-toggle"]',
  "[id^='task-item-']",
  "[data-task-row]",
  "[role='option']",
  "[role='gridcell']",
  ".group\\/card",
  ".group\\/item",
].join(", ");

function InspectorCardShell({
  task,
  onClose,
  shadowClass = "shadow-sm",
}: {
  task: Task | null;
  onClose: () => void;
  shadowClass?: string;
}) {
  return (
    <div
      className={cn(
        "h-full w-full rounded-2xl border border-border/80 bg-card overflow-hidden",
        shadowClass,
      )}
    >
      {task && <TaskDetailPanel task={task} onClose={onClose} />}
    </div>
  );
}

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

function findCachedTask(
  queryClient: QueryClient,
  taskId: string | undefined,
): Task | undefined {
  if (!taskId) return undefined;
  for (const [, tasks] of queryClient.getQueriesData<Task[]>({
    queryKey: ["tasks"],
  })) {
    const found = tasks?.find((t) => t.id === taskId);
    if (found) return found;
  }
  return undefined;
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
  const queryClient = useQueryClient();
  const [selection, setSelectedTask] = useState<Task | null>(null);
  const selectedTask = useSyncExternalStore(
    (notify) => queryClient.getQueryCache().subscribe(notify),
    () => findCachedTask(queryClient, selection?.id) ?? selection,
    () => selection,
  );
  const [keyboardSelectedId, setKeyboardSelectedId] = useState<string | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingDoublePressRef = useRef<{
    key: "g" | "y";
    timestamp: number;
  } | null>(null);
  const reorderMutation = useReorderTasks();
  const deleteMutation = useDeleteTask();
  const toggleMutation = useToggleTask();
  const duplicateMutation = useDuplicateTask();
  const customSortEnteredViaDrag = useUiStore(
    (state) => state.customSortEnteredViaDrag,
  );
  const setCustomSortEnteredViaDrag = useUiStore(
    (state) => state.setCustomSortEnteredViaDrag,
  );
  const viewMode = useUiStore((state) => state.viewMode);
  const boardInspectMode = useUiStore((state) => state.boardInspectMode);
  const isDockedWide = useMediaQuery("(min-width: 1280px)");
  const isDesktopInspector = isDockedWide && !onTaskSelect;
  const isBoardOverlay =
    isDesktopInspector &&
    viewMode === "board" &&
    boardInspectMode === "overlay";
  const isDockedSplit =
    isDesktopInspector &&
    (viewMode === "list" ||
      (viewMode === "board" && boardInspectMode === "split"));
  const isDesktop = useUiStore((state) => state.isDesktop);
  const selectedTaskId = useUiStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useUiStore((state) => state.setSelectedTaskId);
  const hasYankedTask = useUiStore((state) => !!state.yankedTaskId);
  const { openAddTask } = useTaskActions();
  const { trigger: triggerHaptic } = useHaptic();
  const setActiveTaskId = useTimerStore((state) => state.setActiveTaskId);

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

  const dnd = useTaskDnd({
    presentation: processedTasks,
    tasks,
    projectsMap,
    groupBy,
    sortBy,
    isDesktop,
  });

  const listScrollTopRef = useRef(0);
  const boardScrollLeftRef = useRef(0);

  const handleContainerScroll = useCallback(() => {
    if (viewMode === "list" && scrollContainerRef.current) {
      listScrollTopRef.current = scrollContainerRef.current.scrollTop;
    } else if (viewMode === "board") {
      const board = scrollContainerRef.current?.querySelector(
        '[data-testid="task-board-container"]',
      );
      if (board) {
        boardScrollLeftRef.current = board.scrollLeft;
      }
    }
  }, [viewMode]);

  useLayoutEffect(() => {
    if (viewMode === "list" && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = listScrollTopRef.current;
    } else if (viewMode === "board") {
      const board = scrollContainerRef.current?.querySelector(
        '[data-testid="task-board-container"]',
      );
      if (board) {
        board.scrollLeft = boardScrollLeftRef.current;
      }
    }
  }, [viewMode]);

  const prevSortByRef = useRef(sortBy);
  const prevDisplayedFlatRef = useRef<Task[]>([]);
  useLayoutEffect(() => {
    const prevSortBy = prevSortByRef.current;
    prevSortByRef.current = sortBy;

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

    // Pre-paint cache write prevents order jump.
    const orderById = new Map(pairs.map((p) => [p.id, p.day_order]));
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      old?.map((t) =>
        orderById.has(t.id)
          ? { ...t, day_order: orderById.get(t.id) as number }
          : t,
      ),
    );
    reorderMutation.mutate(pairs);
  }, [
    sortBy,
    processedTasks,
    reorderMutation,
    queryClient,
    customSortEnteredViaDrag,
    setCustomSortEnteredViaDrag,
  ]);

  const handleCloseDetail = useCallback(() => {
    triggerHaptic("tick");
    setSelectedTask(null);
    scrollContainerRef.current?.focus({ preventScroll: true });
  }, [triggerHaptic]);

  const [pendingFocusTitle, setPendingFocusTitle] = useState(false);

  const focusInspectorTitle = useCallback(() => {
    if (
      !focusTextareaToEnd(
        document.getElementById(
          TASK_TITLE_EDIT_ID,
        ) as HTMLTextAreaElement | null,
      )
    ) {
      setPendingFocusTitle(true);
    }
  }, []);

  useEffect(() => {
    if (pendingFocusTitle && selectedTask) {
      if (
        focusTextareaToEnd(
          document.getElementById(
            TASK_TITLE_EDIT_ID,
          ) as HTMLTextAreaElement | null,
        )
      ) {
        setPendingFocusTitle(false);
      }
    }
  }, [pendingFocusTitle, selectedTask]);

  const handleTaskClick = useCallback(
    (task: Task) => {
      (document.activeElement as HTMLElement)?.blur();
      if (onTaskSelect) {
        onTaskSelect(task);
      } else {
        setSelectedTask(task);
        setKeyboardSelectedId(task.id);
        if (isDesktopInspector) {
          scrollContainerRef.current?.focus({ preventScroll: true });
        }
      }
    },
    [onTaskSelect, isDesktopInspector],
  );

  // Clear id only once found; the list may still be loading on initial navigation.
  useEffect(() => {
    if (!selectedTaskId) return;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    handleTaskClick(task);
    setSelectedTaskId(null);
  }, [selectedTaskId, tasks, setSelectedTaskId, handleTaskClick]);

  const navigableTasks = useMemo(() => {
    const activeOrGrouped = processedTasks.groups
      ? processedTasks.groups.flatMap((g) => g.tasks)
      : processedTasks.active;
    return [
      ...activeOrGrouped,
      ...processedTasks.evening,
      ...processedTasks.completed,
    ];
  }, [processedTasks]);

  const isAnyModalOpen =
    useIsAnyModalOpen() || (!!selectedTask && !isDesktopInspector);

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

  // Container holds DOM focus for aria-activedescendant without triggering dnd-kit on cards.
  useEffect(() => {
    if (hasSelection) {
      scrollContainerRef.current?.focus({ preventScroll: true });
    }
  }, [hasSelection]);

  // Arrow keys scroll until a task is selected; vim keys always claim keypress.
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
    if (!keyboardSelectedId) return;
    const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
    if (task) {
      toggleMutation.mutate({
        id: task.id,
        is_completed: !task.is_completed,
      });
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
      if (!keyboardSelectedId) return;
      const task = navigableTasks.find((t) => t.id === keyboardSelectedId);
      if (!task) return;

      if (isDesktopInspector) {
        if (selectedTask?.id !== task.id) {
          setSelectedTask(task);
        }
        focusInspectorTitle();
      } else {
        handleTaskClick(task);
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
        const currentIndex = navigableTasks.findIndex(
          (t) => t.id === deletedId,
        );
        const nextTask =
          currentIndex !== -1 && currentIndex + 1 < navigableTasks.length
            ? navigableTasks[currentIndex + 1]
            : currentIndex > 0
              ? navigableTasks[currentIndex - 1]
              : null;

        handleNavVertical(1);
        deleteMutation.mutate(deletedId);

        if (selectedTask?.id === deletedId) {
          setSelectedTask(nextTask);
        }
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
      // Resolves fresh across task queries so cross-view edits since yank are reflected.
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
      if (yankedTask.unreadable) {
        notify.error("Can't duplicate a task whose text can't be read");
        return;
      }
      const targetColumn =
        viewMode === "board"
          ? boardColumns.find((c) =>
              c.tasks.some((t) => t.id === keyboardSelectedId),
            )
          : undefined;
      const overrides = getPasteOverrides({
        projectId,
        filter,
        targetColumnTitle: targetColumn?.title,
        projectsMap,
        groupBy,
      });
      duplicateMutation.mutate(
        { sourceTask: yankedTask, overrides },
        {
          onSuccess: (newDuplicateTask) => {
            if (newDuplicateTask?.id) {
              setKeyboardSelectedId(newDuplicateTask.id);
            }
          },
        },
      );
    },
    hotkeyOptions,
  );

  useHotkeys(
    "escape",
    () => {
      clearPendingDoublePress();
      setKeyboardSelectedId(null);
      setSelectedTask(null);
      // Clear yanked task on Escape so GlobalHotkeys 'p' is not suppressed.
      if (hasYankedTask) useUiStore.getState().setYankedTaskId(null);
    },
    {
      enabled:
        !isAnyModalOpen && (hasSelection || hasYankedTask || !!selectedTask),
    },
  );

  const handleInspectorKeyDownCapture = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        scrollContainerRef.current?.focus({ preventScroll: true });
      }
    },
    [],
  );

  // Follow active task selection when desktop inspector is open during Vim traversal
  useEffect(() => {
    if (
      isDesktopInspector &&
      selectedTask &&
      keyboardSelectedId &&
      keyboardSelectedId !== selectedTask.id
    ) {
      const nextTask = navigableTasks.find((t) => t.id === keyboardSelectedId);
      if (nextTask) {
        setSelectedTask(nextTask);
      }
    }
  }, [isDesktopInspector, selectedTask, keyboardSelectedId, navigableTasks]);

  // Initial URL check: hydrate task from ?task=<id> without stripping it on
  // mount. Works at every tier (spec stories 21–22): on desktop the docked/
  // overlay inspector opens; below 1280px the TaskSheet modal opens and
  // ResponsiveDialog's useBackNavigation gives the native back-button
  // dismissal with a synthetic back anchor.
  const initialUrlCheckedRef = useRef(false);
  useEffect(() => {
    if (initialUrlCheckedRef.current || onTaskSelect) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const taskIdFromUrl = url.searchParams.get("task");
    if (!taskIdFromUrl) {
      initialUrlCheckedRef.current = true;
      return;
    }
    if (tasks.length > 0) {
      initialUrlCheckedRef.current = true;
      const matchingTask = tasks.find((t) => t.id === taskIdFromUrl);
      if (matchingTask) {
        setSelectedTask(matchingTask);
        setKeyboardSelectedId(matchingTask.id);
      }
    }
  }, [onTaskSelect, tasks]);

  // Inspecting a task reflects ?task=<id> via replaceState without pushing
  // history; closing strips it (also below 1280px, where the sheet's
  // onOpenChange -> setSelectedTask(null) drives this effect).
  useEffect(() => {
    if (onTaskSelect || !initialUrlCheckedRef.current) {
      return;
    }
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const currentParam = url.searchParams.get("task");

    if (selectedTask) {
      if (currentParam === selectedTask.id) return;
      url.searchParams.set("task", selectedTask.id);
    } else {
      if (!currentParam) return;
      url.searchParams.delete("task");
    }

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [onTaskSelect, selectedTask]);

  // Global pointerdown listener for dismissing inspector on empty canvas, topbar, sidebar, or header
  useEffect(() => {
    if (!isDesktopInspector || !selectedTask) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only dismiss on primary click
      if (e.button !== 0 || dnd.isDragging) return;

      const target = e.target as HTMLElement | null;
      if (!target || !target.isConnected) return;

      // Retain inspection for interactions inside inspector, portalled overlays, tabs, or task cards
      if (target.closest(DISMISS_IGNORE_SELECTOR)) return;

      // Clicks on topbar, page header, app sidebar, or empty canvas voids: dismiss inspector
      handleCloseDetail();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isDesktopInspector, selectedTask, dnd.isDragging, handleCloseDetail]);

  const [preservedTask, setPreservedTask] = useState<Task | null>(selectedTask);
  useEffect(() => {
    if (selectedTask) {
      setPreservedTask(selectedTask);
    }
  }, [selectedTask]);
  const activeInspectorTask = selectedTask ?? preservedTask;

  const overlayContent = useMemo(() => {
    if (!dnd.activeTask) return null;
    const project = projectsMap.get(dnd.activeTask.project_id || "inbox");
    const isBoard = viewMode === "board";
    const widthStyle =
      dnd.activeWidth != null
        ? {
            width: isBoard
              ? `${dnd.activeWidth}px`
              : `${Math.round(dnd.activeWidth * 0.96)}px`,
          }
        : undefined;

    return (
      <div
        style={widthStyle}
        className={cn(
          "opacity-90 pointer-events-none will-change-transform rotate-1 scale-[1.02]",
          isBoard
            ? !dnd.activeWidth && "w-[280px]"
            : !dnd.activeWidth && "w-full max-w-[90vw]",
        )}
      >
        <TaskGhost
          task={dnd.activeTask}
          isDesktop={isDesktop}
          viewMode={viewMode}
          project={project}
        />
      </div>
    );
  }, [dnd.activeTask, dnd.activeWidth, projectsMap, isDesktop, viewMode]);

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
      <div className="px-4 md:px-6 max-md:flex max-md:h-full max-md:flex-col max-md:justify-center">
        <EmptyState
          className="max-md:py-8"
          icon={CheckSquare}
          description="Write down what you need to do. Add a date or a project when it helps."
          action={{
            label: "Add task",
            onClick: () => {
              triggerHaptic("toggle");
              openAddTask();
            },
            icon: Plus,
            shortcut: "N",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={dnd.collisionDetection}
        onDragStart={dnd.onDragStart}
        onDragOver={dnd.onDragOver}
        onDragEnd={dnd.onDragEnd}
        onDragCancel={dnd.onDragCancel}
        accessibility={{ announcements: dndAnnouncements }}
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
        <div className="flex h-full w-full overflow-hidden relative">
          <div
            ref={scrollContainerRef}
            data-task-list-scroll-container="true"
            role={viewMode === "board" ? "grid" : "listbox"}
            aria-label={viewMode === "board" ? "Task board" : "Task list"}
            tabIndex={0}
            onScroll={handleContainerScroll}
            aria-activedescendant={
              keyboardSelectedId ? taskDomId(keyboardSelectedId) : undefined
            }
            className={cn(
              "h-full overflow-y-auto scrollbar-hide relative overscroll-contain focus-visible:outline-none motion-reduce:transition-none",
              isDockedSplit
                ? cn(
                    "transition-[width] duration-200",
                    selectedTask ? "w-[60%] shrink-0" : "w-full flex-1",
                  )
                : "flex-1 w-full",
            )}
            style={{
              contain: "strict",
              ...(isDockedSplit
                ? { transitionTimingFunction: "var(--ease-seijaku)" }
                : {}),
            }}
          >
            {viewMode === "board" ? (
              <TaskBoard
                presentation={dnd.displayPresentation}
                projectsMap={projectsMap}
                onSelect={handleTaskClick}
                isDesktop={isDesktop}
                triggerHaptic={triggerHaptic}
                setActiveTaskId={setActiveTaskId}
                groupBy={groupBy}
                keyboardSelectedId={keyboardSelectedId}
                isDndActive={dnd.isDragging}
                onScroll={handleContainerScroll}
              />
            ) : (
              <TaskListView
                processedTasks={processedTasks}
                activeTasks={dnd.displayPresentation.active}
                eveningTasks={dnd.displayPresentation.evening}
                groupTasks={dnd.displayPresentation.groups}
                handleTaskClick={handleTaskClick}
                keyboardSelectedId={keyboardSelectedId}
                isDndActive={dnd.isDragging}
                projectsMap={projectsMap}
                isDesktop={isDesktop}
                triggerHaptic={triggerHaptic}
                setActiveTaskId={setActiveTaskId}
              />
            )}
          </div>

          {isDockedSplit && (
            <div
              data-testid="docked-task-inspector"
              data-task-inspector="true"
              className={cn(
                "h-full overflow-hidden shrink-0 transition-[width,opacity,padding] duration-200 motion-reduce:transition-none",
                selectedTask
                  ? "w-[40%] opacity-100 pt-2 pr-4 md:pr-6 pb-8 pl-0"
                  : "w-0 opacity-0 p-0 pointer-events-none",
              )}
              style={{ transitionTimingFunction: "var(--ease-seijaku)" }}
              onKeyDownCapture={handleInspectorKeyDownCapture}
            >
              <InspectorCardShell
                task={activeInspectorTask}
                onClose={handleCloseDetail}
              />
            </div>
          )}

          {isBoardOverlay && (
            <div
              data-testid="board-overlay-drawer"
              data-task-inspector="true"
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 w-[440px] pt-2 pr-4 md:pr-6 pb-8 pl-0 transition-[transform,opacity] duration-200 motion-reduce:transition-none pointer-events-auto",
                selectedTask
                  ? "translate-x-0 opacity-100"
                  : "translate-x-full opacity-0 pointer-events-none",
              )}
              style={{ transitionTimingFunction: "var(--ease-seijaku)" }}
              onKeyDownCapture={handleInspectorKeyDownCapture}
            >
              <InspectorCardShell
                task={activeInspectorTask}
                onClose={handleCloseDetail}
                shadowClass="shadow-xl"
              />
            </div>
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
        open={!!selectedTask && !isDesktopInspector}
        onClose={() => setSelectedTask(null)}
        initialTask={selectedTask}
      />
    </>
  );
}

const TaskList = memo(TaskListBase);
export default TaskList;
