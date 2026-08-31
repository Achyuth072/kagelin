"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  defaultAnnouncements,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import {
  useCreateTask,
  useToggleTask,
  useDeleteTask,
  useUpdateTask,
  useReorderTasks,
} from "@/lib/hooks/useTaskMutations";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { priorityCheckboxClasses } from "./task-utils";
import { useSortableRow, dropLineClasses } from "@/lib/hooks/useSortableRow";
import { DragHandle } from "@/components/tasks/DragHandle";
import { computeReorderPairs } from "@/lib/utils/task-dnd";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

interface SubtaskListProps {
  taskId?: string;
  projectId: string | null;
  draftSubtasks?: string[];
  onDraftSubtasksChange?: (subtasks: string[]) => void;
  pendingContent?: string;
  onPendingContentChange?: (content: string) => void;
  onCollapse?: () => void;
  allowReorder?: boolean;
}

interface SubtaskRowProps {
  id: string;
  index: number;
  content: string;
  isCompleted: boolean;
  isDraftMode: boolean;
  isEditing: boolean;
  editingContent: string;
  allowReorder?: boolean;
  isDesktop: boolean;
  onStartEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (idOrIndex: string | number) => void;
  onToggle: (id: string, checked: boolean) => void;
  onEditingContentChange: (val: string) => void;
  onEditKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
    index: number,
  ) => void;
}

function SubtaskItemContent({
  id,
  index,
  content,
  isCompleted,
  isDraftMode,
  isEditing,
  editingContent,
  onStartEdit,
  onSaveEdit,
  onDelete,
  onToggle,
  onEditingContentChange,
  onEditKeyDown,
}: SubtaskRowProps) {
  const { trigger } = useHaptic();

  return (
    <>
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => onToggle(id, checked as boolean)}
        disabled={isDraftMode}
        aria-label={`Mark "${content}" complete`}
        className={cn(
          "mt-0.5 h-3.5 w-3.5 !rounded-sm",
          priorityCheckboxClasses[4],
        )}
      />
      {isEditing ? (
        <Input
          autoFocus
          value={editingContent}
          onChange={(e) => onEditingContentChange(e.target.value)}
          onFocus={(e) =>
            e.currentTarget.setSelectionRange(
              e.currentTarget.value.length,
              e.currentTarget.value.length,
            )
          }
          onBlur={() => onSaveEdit(id)}
          onKeyDown={(e) => onEditKeyDown(e, id, index)}
          aria-label="Edit step"
          className="flex-1 h-7 py-0 px-0 text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0"
        />
      ) : (
        <span
          onClick={() => onStartEdit(id, content)}
          className={cn(
            "flex-1 text-[14px] leading-snug transition-all break-all cursor-text",
            isCompleted &&
              "text-muted-foreground/60 line-through decoration-muted-foreground/20",
          )}
        >
          {content}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete subtask"
        className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-destructive md:text-muted-foreground md:hover:text-destructive hover:bg-destructive-surface-hover rounded-lg"
        onClick={() => {
          trigger("tick");
          onDelete(id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}

function SortableSubtaskItem(props: SubtaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
    dropLine,
    dndStyle,
  } = useSortableRow(props.id, { respectReducedMotion: true });

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "group relative flex items-center gap-2.5 py-1.5 px-3 hover:bg-secondary/10 rounded-lg transition-colors",
        isDragging ? "z-20 opacity-30" : "z-10 opacity-100",
        isDragging && "will-change-transform",
        dropLineClasses(dropLine),
      )}
    >
      <DragHandle
        ref={setActivatorNodeRef}
        dragListeners={listeners}
        dragAttributes={attributes}
        variant={props.isDesktop ? "desktop" : "mobile"}
        className="shrink-0"
      />
      <SubtaskItemContent {...props} />
    </div>
  );
}

function StaticSubtaskItem(props: SubtaskRowProps) {
  return (
    <div className="group flex items-center gap-3 py-1.5 px-3 hover:bg-secondary/10 rounded-lg transition-colors">
      <SubtaskItemContent {...props} />
    </div>
  );
}

export default function SubtaskList({
  taskId,
  projectId,
  draftSubtasks = [],
  onDraftSubtasksChange,
  pendingContent: controlledPendingContent,
  onPendingContentChange: setControlledPendingContent,
  onCollapse,
  allowReorder = false,
}: SubtaskListProps) {
  const isDesktop = useUiStore((s) => s.isDesktop);
  const { trigger: triggerHaptic } = useHaptic();

  const [internalNewSubtaskContent, setInternalNewSubtaskContent] =
    useState("");
  const newStepInputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledPendingContent !== undefined;
  const newSubtaskContent = isControlled
    ? controlledPendingContent
    : internalNewSubtaskContent;
  const setNewSubtaskContent = (val: string) => {
    if (isControlled) {
      setControlledPendingContent?.(val);
    } else {
      setInternalNewSubtaskContent(val);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const { data: subtasks } = useSubtasks(taskId || null);
  const createMutation = useCreateTask();
  const toggleMutation = useToggleTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const reorderMutation = useReorderTasks();

  const isDraftMode = !taskId;
  const items = useMemo(
    () => (isDraftMode ? draftSubtasks : subtasks || []),
    [isDraftMode, draftSubtasks, subtasks],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [lockLocal, setLockLocal] = useState(false);
  const [localItems, setLocalItems] = useState<(string | Task)[]>([]);

  const displayItems = useMemo(
    () => (activeId || lockLocal ? localItems : items),
    [activeId, lockLocal, localItems, items],
  );

  const getItemId = (item: string | Task, index: number): string => {
    return typeof item === "string" ? `draft-${index}` : item.id;
  };

  const itemIds = useMemo(
    () => displayItems.map((item, index) => getItemId(item, index)),
    [displayItems],
  );

  const mouseSensor = useSensor(MouseSensor, {
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

  const handleDragStart = (event: DragStartEvent) => {
    setLocalItems(items);
    setActiveId(event.active.id as string);
    triggerHaptic("toggle");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setLockLocal(false);
      setLocalItems(items);
      setActiveId(null);
      return;
    }

    const currentList = localItems.length > 0 ? localItems : items;
    const oldIndex = currentList.findIndex(
      (it, idx) => getItemId(it, idx) === active.id,
    );
    const newIndex = currentList.findIndex(
      (it, idx) => getItemId(it, idx) === over.id,
    );

    if (oldIndex === -1 || newIndex === -1) {
      setActiveId(null);
      return;
    }

    const reordered = arrayMove(currentList, oldIndex, newIndex);
    setLocalItems(reordered);

    if (isDraftMode) {
      onDraftSubtasksChange?.(reordered as string[]);
      setActiveId(null);
    } else {
      setLockLocal(true);
      setActiveId(null);
      const pairs = computeReorderPairs(
        active.id as string,
        reordered.map((t) => (t as Task).id),
        items as Task[],
        true,
      );
      triggerHaptic("thud");
      reorderMutation.mutate(pairs, {
        onSettled: () => setLockLocal(false),
      });
    }
  };

  const activeContent = useMemo(() => {
    if (!activeId) return null;
    const item = displayItems.find(
      (it, idx) => getItemId(it, idx) === activeId,
    );
    if (!item) return null;
    return typeof item === "string" ? item : item.content;
  }, [activeId, displayItems]);

  const handleStartEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditingContent(content);
  };

  const handleDeleteSubtask = (idOrIndex: string | number) => {
    if (isDraftMode) {
      const index =
        typeof idOrIndex === "number"
          ? idOrIndex
          : parseInt(idOrIndex.replace("draft-", ""), 10);
      if (!isNaN(index)) {
        onDraftSubtasksChange?.(draftSubtasks.filter((_, i) => i !== index));
      }
    } else {
      deleteMutation.mutate(idOrIndex as string);
    }
  };

  const handleToggleSubtask = (id: string, checked: boolean) => {
    if (!isDraftMode) {
      triggerHaptic("toggle");
      toggleMutation.mutate({
        id,
        is_completed: checked,
      });
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editingId !== id) return;
    const trimmed = editingContent.trim();
    if (!trimmed) {
      handleDeleteSubtask(id);
    } else {
      if (isDraftMode) {
        const index = parseInt(id.replace("draft-", ""), 10);
        if (!isNaN(index)) {
          onDraftSubtasksChange?.(
            draftSubtasks.map((item, i) => (i === index ? trimmed : item)),
          );
        }
      } else {
        updateMutation.mutate({
          id,
          content: trimmed,
        });
      }
    }
    setEditingId(null);
  };

  const handleAddSubtask = (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = newSubtaskContent.trim();
    if (!content) return;

    setNewSubtaskContent("");

    if (isDraftMode) {
      onDraftSubtasksChange?.([...draftSubtasks, content]);
    } else {
      createMutation.mutate({
        content,
        project_id: projectId || undefined,
        parent_id: taskId,
        priority: 4,
      });
    }
    newStepInputRef.current?.focus();
  };

  const handleNewStepKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        return;
      }
      e.preventDefault();
      if (newSubtaskContent.trim()) {
        handleAddSubtask();
      } else {
        onCollapse?.();
      }
    } else if (e.key === "Backspace") {
      if (!newSubtaskContent && items.length > 0) {
        e.preventDefault();
        const lastIndex = items.length - 1;
        const lastItem = items[lastIndex];
        const lastId =
          typeof lastItem === "string" ? `draft-${lastIndex}` : lastItem.id;
        handleDeleteSubtask(lastId);

        if (lastIndex > 0) {
          const prevIndex = lastIndex - 1;
          const prevItem = items[prevIndex];
          const prevId =
            typeof prevItem === "string" ? `draft-${prevIndex}` : prevItem.id;
          const prevContent =
            typeof prevItem === "string" ? prevItem : prevItem.content;
          setEditingId(prevId);
          setEditingContent(prevContent);
        } else {
          newStepInputRef.current?.focus();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setNewSubtaskContent("");
      newStepInputRef.current?.blur();
    }
  };

  const handleEditKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
    index: number,
  ) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        return;
      }
      e.preventDefault();
      handleSaveEdit(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditingId(null);
    } else if (e.key === "Backspace") {
      if (editingContent === "") {
        e.preventDefault();
        handleDeleteSubtask(id);
        setEditingId(null);

        if (index > 0) {
          const prevIndex = index - 1;
          const prevItem = items[prevIndex];
          const prevId =
            typeof prevItem === "string" ? `draft-${prevIndex}` : prevItem.id;
          const prevContent =
            typeof prevItem === "string" ? prevItem : prevItem.content;
          setEditingId(prevId);
          setEditingContent(prevContent);
        } else {
          newStepInputRef.current?.focus();
        }
      }
    }
  };

  const rows = displayItems.map((item, index) => {
    const id = getItemId(item, index);
    const content = typeof item === "string" ? item : item.content;
    const isCompleted = typeof item === "string" ? false : item.is_completed;
    const isEditing = editingId === id;

    const rowProps: SubtaskRowProps = {
      id,
      index,
      content,
      isCompleted,
      isDraftMode,
      isEditing,
      editingContent,
      allowReorder,
      isDesktop,
      onStartEdit: handleStartEdit,
      onSaveEdit: handleSaveEdit,
      onCancelEdit: () => setEditingId(null),
      onDelete: handleDeleteSubtask,
      onToggle: handleToggleSubtask,
      onEditingContentChange: setEditingContent,
      onEditKeyDown: handleEditKeyDown,
    };

    if (allowReorder) {
      return <SortableSubtaskItem key={id} {...rowProps} />;
    }

    return <StaticSubtaskItem key={id} {...rowProps} />;
  });

  return (
    <div className="space-y-1 py-1 w-full">
      {allowReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements: dndAnnouncements }}
          measuring={{
            droppable: { strategy: MeasuringStrategy.WhileDragging },
          }}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {rows}
          </SortableContext>

          {typeof document !== "undefined" &&
            createPortal(
              <DragOverlay
                dropAnimation={{
                  duration: 0,
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: { active: { opacity: "0.5" } },
                  }),
                }}
              >
                {activeContent && (
                  <div className="flex items-center gap-2.5 py-1.5 px-3 bg-background/95 backdrop-blur-sm rounded-lg border border-border shadow-md opacity-90">
                    <DragHandle
                      variant={isDesktop ? "desktop" : "mobile"}
                      className="shrink-0 opacity-100"
                    />
                    <Checkbox
                      checked={false}
                      disabled
                      aria-label={`Step "${activeContent}"`}
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 !rounded-sm",
                        priorityCheckboxClasses[4],
                      )}
                    />
                    <span className="flex-1 text-[14px] leading-snug truncate">
                      {activeContent}
                    </span>
                  </div>
                )}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      ) : (
        rows
      )}

      <div className="flex items-center gap-3 px-3 pt-1 group">
        <button
          type="button"
          aria-label="Add step"
          disabled={!newSubtaskContent.trim()}
          className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-muted-foreground group-focus-within:text-brand hover:text-brand disabled:hover:text-muted-foreground transition-colors"
          onClick={() => handleAddSubtask()}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <Input
          ref={newStepInputRef}
          value={newSubtaskContent}
          onChange={(e) => setNewSubtaskContent(e.target.value)}
          onKeyDown={handleNewStepKeyDown}
          placeholder="Add a step..."
          aria-label="Add a step"
          className="flex-1 h-8 text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground transition-colors p-0"
        />
      </div>
    </div>
  );
}
