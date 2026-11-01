"use client";

import type { Task } from "@/lib/types/task";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { X, Columns2, PanelRight } from "lucide-react";
import { useUiStore } from "@/lib/store/uiStore";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { TaskView } from "./TaskView";
import { TaskEditorProvider, useTaskEditorContext } from "./TaskEditorProvider";

interface TaskDetailPanelProps {
  task: Task | null;
  onClose?: () => void;
}

function TaskDetailPanelContent({ onClose }: { onClose?: () => void }) {
  const { trigger } = useHaptic();
  const { onKeyDown } = useTaskEditorContext();
  const viewMode = useUiStore((state) => state.viewMode);
  const boardInspectMode = useUiStore((state) => state.boardInspectMode);
  const setBoardInspectMode = useUiStore((state) => state.setBoardInspectMode);
  const isDockedWide = useMediaQuery("(min-width: 1280px)");

  const isOverlay = boardInspectMode === "overlay";
  const toggleLabel = isOverlay
    ? "Switch to split view"
    : "Switch to overlay drawer";

  return (
    <div className="flex flex-col h-full bg-card" onKeyDown={onKeyDown}>
      {onClose && (
        <div className="shrink-0 flex items-center justify-end gap-2 px-4 pt-3">
          {viewMode === "board" && isDockedWide && (
            <button
              type="button"
              data-testid="board-inspect-mode-toggle"
              onClick={() => {
                trigger("toggle");
                setBoardInspectMode(isOverlay ? "split" : "overlay");
              }}
              className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border/80 transition-all duration-200 text-xs font-medium"
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              {isOverlay ? (
                <>
                  <Columns2 className="h-4 w-4 opacity-80" strokeWidth={2} />
                  <span className="hidden sm:inline">Split</span>
                </>
              ) : (
                <>
                  <PanelRight className="h-4 w-4 opacity-80" strokeWidth={2} />
                  <span className="hidden sm:inline">Overlay</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
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
