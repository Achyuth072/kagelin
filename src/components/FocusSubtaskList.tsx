"use client";

import { useState } from "react";
import { useTimerStore } from "@/lib/store/timerStore";
import { useActiveTask } from "@/lib/hooks/useActiveTask";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { useHaptic } from "@/lib/hooks/useHaptic";
import SubtaskList from "@/components/tasks/SubtaskList";

export function FocusSubtaskList() {
  const activeTaskId = useTimerStore((s) => s.state.activeTaskId);
  const { data: resolvedActiveTask } = useActiveTask(activeTaskId);
  const { data: subtasks } = useSubtasks(activeTaskId);
  const { trigger } = useHaptic();

  const [prevTaskId, setPrevTaskId] = useState(activeTaskId);
  const [isExpanded, setIsExpanded] = useState(false);

  const total = subtasks?.length ?? 0;
  const completed = subtasks?.filter((s) => s.is_completed).length ?? 0;

  if (prevTaskId !== activeTaskId) {
    setPrevTaskId(activeTaskId);
    setIsExpanded(false);
  }

  if (!activeTaskId || total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center mt-2 w-full max-w-xs">
      <button
        type="button"
        onClick={() => {
          trigger("toggle");
          setIsExpanded((prev) => !prev);
        }}
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
      >
        <span>{isExpanded ? "▾" : "▸"}</span>
        <span>
          {completed}/{total} steps
        </span>
      </button>

      {isExpanded && (
        <div className="w-full mt-2 bg-secondary/20 border border-border/40 rounded-xl p-2 text-left max-h-[30vh] overflow-y-auto">
          <SubtaskList
            taskId={activeTaskId}
            projectId={resolvedActiveTask?.project_id ?? null}
            allowReorder={false}
            onCollapse={() => setIsExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}
