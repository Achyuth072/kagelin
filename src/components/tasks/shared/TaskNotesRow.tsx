"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { AlignLeft } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { TaskNotesEditor } from "./TaskNotesEditor";

interface TaskNotesRowProps {
  description: string;
  setDescription: (value: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: Dispatch<SetStateAction<boolean>>;
  defaultPreviewOnOpen: boolean;
}

export function TaskNotesRow({
  description,
  setDescription,
  isPreviewMode,
  setIsPreviewMode,
  defaultPreviewOnOpen,
}: TaskNotesRowProps) {
  const { trigger } = useHaptic();
  const [notesEditorOpen, setNotesEditorOpen] = useState(false);

  return (
    <>
      <div className="mx-2">
        <button
          type="button"
          onClick={() => {
            trigger("toggle");
            setIsPreviewMode(defaultPreviewOnOpen);
            setNotesEditorOpen(true);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast text-left hover:bg-muted/40"
        >
          <IconCell>
            <AlignLeft
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.25}
            />
          </IconCell>
          <span
            className={cn(
              "text-sm flex-1 min-w-0 truncate text-foreground",
              !description.trim() && "text-muted-foreground",
            )}
          >
            {description.trim() || "Add details... (Markdown supported)"}
          </span>
        </button>
      </div>

      <TaskNotesEditor
        open={notesEditorOpen}
        onOpenChange={setNotesEditorOpen}
        description={description}
        setDescription={setDescription}
        isPreviewMode={isPreviewMode}
        setIsPreviewMode={setIsPreviewMode}
      />
    </>
  );
}
