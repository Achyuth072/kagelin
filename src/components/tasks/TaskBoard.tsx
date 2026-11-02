"use client";

import React, { useMemo, memo } from "react";
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
  isDndActive?: boolean;
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
  isDndActive = false,
}: TaskBoardProps) {
  const isJsLoaded = useJsLoaded();

  const boardColumns = useMemo<TaskGroup[]>(
    () => (presentation ? getBoardColumns(presentation) : []),
    [presentation],
  );

  if (!isJsLoaded) return null;

  return (
    <div
      className={`flex items-start h-full overflow-x-auto pb-12 md:pb-6 px-4 md:px-6 gap-6 scrollbar-hide${isDndActive ? "" : " snap-x snap-mandatory"}`}
      data-testid="task-board-container"
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
}: {
  group: TaskGroup;
  projectsMap: Map<string, Project>;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  setActiveTaskId: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
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
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/40 rounded-2xl">
              <span className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                Ma (Void)
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
});
