"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTimerStore } from "@/lib/store/timerStore";
import { useActiveTask } from "@/lib/hooks/useActiveTask";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
    // Portaled to avoid reflowing the timer below.
    <Popover
      open={isExpanded}
      onOpenChange={(open) => {
        trigger("toggle");
        setIsExpanded(open);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-all duration-200",
              isExpanded && "rotate-90 text-brand",
            )}
            strokeWidth={2.5}
          />
          <span>
            {completed}/{total} steps
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        collisionPadding={16}
        className="w-[320px] max-w-[calc(100vw-2rem)] p-2 bg-popover/95 backdrop-blur-md border-border/40 shadow-xl max-h-[50vh] overflow-y-auto text-left"
      >
        <SubtaskList
          taskId={activeTaskId}
          projectId={resolvedActiveTask?.project_id ?? null}
          allowReorder={false}
          onCollapse={() => setIsExpanded(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
