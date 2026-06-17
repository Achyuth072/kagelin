"use client";

import { useMemo, useState } from "react";
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
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { useReorderHabits } from "@/lib/hooks/useHabitMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { computeReorderPairs } from "@/lib/utils/habit-dnd";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import { HabitCompactRow } from "./HabitCompactRow";
import { SortableHabitCompactRow } from "./SortableHabitCompactRow";

interface HabitCompactListProps {
  habits: HabitWithEntries[];
  onEditHabit: (habit: HabitWithEntries) => void;
  onViewInsights?: (habit: HabitWithEntries) => void;
}

/**
 * Folio-continuous compact view: one container, rows separated by border-b
 * (DESIGN_SYSTEM List geometry), drag-to-reorder via the task dnd-kit hybrid
 * (desktop left-edge handle, mobile whole-row long-press).
 */
export function HabitCompactList({
  habits,
  onEditHabit,
  onViewInsights,
}: HabitCompactListProps) {
  const isDesktop = useUiStore((s) => s.isDesktop);
  const { trigger: triggerHaptic } = useHaptic();
  const reorderMutation = useReorderHabits();

  const [activeId, setActiveId] = useState<string | null>(null);
  // Holds local order across the reorder mutation's async cache update, until
  // onSettled fires — prevents the list snapping back to server order.
  const [lockLocal, setLockLocal] = useState(false);
  // Only read while dragging/locked; seeded on drag start. Outside that window
  // displayHabits falls through to the source `habits`, so no effect sync.
  const [localHabits, setLocalHabits] = useState<HabitWithEntries[]>(habits);

  const displayHabits = useMemo(
    () => (activeId || lockLocal ? localHabits : habits),
    [activeId, lockLocal, localHabits, habits],
  );
  const habitIds = useMemo(
    () => displayHabits.map((h) => h.id),
    [displayHabits],
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
    setLocalHabits(habits);
    setActiveId(event.active.id as string);
    triggerHaptic("toggle");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setLockLocal(false);
      setLocalHabits(habits);
      setActiveId(null);
      return;
    }

    const oldIndex = localHabits.findIndex((h) => h.id === active.id);
    const newIndex = localHabits.findIndex((h) => h.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      setActiveId(null);
      return;
    }

    const reordered = arrayMove(localHabits, oldIndex, newIndex);
    setLocalHabits(reordered);

    // CRITICAL ORDERING: lockLocal BEFORE activeId — keeps displayHabits on the
    // local order until the optimistic cache update lands (see TaskList).
    setLockLocal(true);
    setActiveId(null);

    const pairs = computeReorderPairs(
      reordered.map((h) => h.id),
      habits,
    );
    triggerHaptic("thud");
    reorderMutation.mutate(pairs, {
      onSettled: () => setLockLocal(false),
    });
  };

  const activeHabit = activeId
    ? displayHabits.find((h) => h.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {displayHabits.map((habit) => (
            <SortableHabitCompactRow
              key={habit.id}
              habit={habit}
              icon={getHabitIcon(habit.icon)}
              onEdit={() => onEditHabit(habit)}
              onViewInsights={
                onViewInsights ? () => onViewInsights(habit) : undefined
              }
              isDesktop={isDesktop}
            />
          ))}
        </div>
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
            {activeHabit && (
              <div className="overflow-hidden rounded-xl border border-border bg-background opacity-90 shadow-sm">
                <HabitCompactRow
                  habit={activeHabit}
                  icon={getHabitIcon(activeHabit.icon)}
                  isDesktop={isDesktop}
                />
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
