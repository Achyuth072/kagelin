"use client";

import type { Task } from "@/lib/types/task";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { X } from "lucide-react";
import { TaskView } from "./TaskView";
import { TaskEditorProvider, useTaskEditorContext } from "./TaskEditorProvider";

interface TaskDetailPanelProps {
  task: Task | null;
  onClose?: () => void;
}

function TaskDetailPanelContent({ onClose }: { onClose?: () => void }) {
  const { trigger } = useHaptic();
  const { onKeyDown } = useTaskEditorContext();

  return (
    <div className="flex flex-col h-full bg-card" onKeyDown={onKeyDown}>
      {onClose && (
        <div className="shrink-0 flex justify-end px-4 pt-3">
          <button
            onClick={() => {
              trigger("tick");
              onClose();
            }}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border/80 transition-all duration-200"
            aria-label="Close task details"
          >
            <X className="h-5 w-5 opacity-80" strokeWidth={2.25} />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TaskView layout="panel" />
      </div>
    </div>
  );
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  if (!task) {
    return (
      <div className="flex h-full items-center justify-center p-16 animate-in fade-in duration-500 bg-card">
        <p className="type-body text-muted-foreground font-medium">
          Select a task to view details
        </p>
      </div>
    );
  }

  return (
    <TaskEditorProvider task={task} onClose={onClose} autoFocusTitle={false}>
      <TaskDetailPanelContent onClose={onClose} />
    </TaskEditorProvider>
  );
}
