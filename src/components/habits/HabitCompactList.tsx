"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
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
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { useReorderHabits } from "@/lib/hooks/useHabitMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { computeReorderPairs } from "@/lib/utils/habit-dnd";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import { getRolling7Days } from "@/lib/utils/habit-rolling";
import { dayValue } from "@/lib/utils/habit-score";
import { cn } from "@/lib/utils";
import { HabitCompactRow } from "./HabitCompactRow";
import { SortableHabitCompactRow } from "./SortableHabitCompactRow";

// Suppress dnd-kit's built-in per-onDragOver a11y announcement (fires at
// drag-over frequency by default) — keep start/end/cancel. See TaskList.tsx.
const dndAnnouncements = {
  ...defaultAnnouncements,
  onDragOver: () => undefined,
};

interface HabitCompactListProps {
  habits: HabitWithEntries[];
  onEditHabit: (habit: HabitWithEntries) => void;
  onViewInsights?: (habit: HabitWithEntries) => void;
}

/**
 * Timeline Matrix compact view (Variant B):
 * - Folio-continuous container with synchronized 7-day timeline header.
 * - Desktop row height: 44px (h-11) for comfortable power-user density.
 * - 24px × 24px squircle cells with 4px tactile gaps.
 * - Drag-to-reorder via dnd-kit hybrid (desktop left-edge handle, mobile long-press).
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

  const displayHabits = activeId || lockLocal ? localHabits : habits;
  const habitIds = displayHabits.map((h) => h.id);

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const headerDays = getRolling7Days([], now, null);

  const completedTodayCount = habits.filter((h) => {
    const entry = h.entries.find((e) => e.date === todayStr);
    return entry != null && dayValue(entry.value, h) >= 1;
  }).length;

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
      accessibility={{ announcements: dndAnnouncements }}
      // WhileDragging measures the same as Always during a drag; Always
      // additionally re-measures on every droppable registry mutation while
      // idle, which is pure overhead for this flat single-list case.
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
    >
      <div className="w-full flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden">
        {/* Synchronized Timeline Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border/60 select-none">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold tracking-tight uppercase text-foreground">
              Habits
            </span>
            <span className="text-[11px] font-medium bg-secondary border border-border/60 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums">
              {completedTodayCount} of {habits.length} done today
            </span>
          </div>

          {/* 7-Day Calendar Strip Header (Synchronized with 192px squircle grid) */}
          <div className="hidden sm:flex items-center">
            <div className="grid grid-cols-7 gap-1 w-[192px] text-center">
              {headerDays.map((d) => {
                const dateNum = format(parseISO(d.date), "d");
                return (
                  <div
                    key={d.date}
                    className={cn(
                      "flex flex-col items-center leading-none py-1 rounded-[6px] transition-colors",
                      d.isToday
                        ? "bg-secondary font-bold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {d.weekdayLabel}
                    </span>
                    <span className="text-xs tabular-nums font-semibold mt-0.5">
                      {dateNum}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Spacer matching row's onViewInsights button (w-7 ml-2) for column alignment */}
            {onViewInsights && <div className="w-7 ml-2" />}
          </div>
        </div>

        {/* Sortable Rows */}
        <SortableContext
          items={habitIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-border/40">
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
      </div>

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
              <div className="overflow-hidden rounded-xl border border-border bg-card opacity-90 shadow-sm">
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
