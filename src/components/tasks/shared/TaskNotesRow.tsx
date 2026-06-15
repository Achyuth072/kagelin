"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlignLeft } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { IconCell } from "@/components/ui/IconCell";
import { TaskNotesEditor } from "./TaskNotesEditor";

interface TaskNotesRowProps {
  description: string;
  setDescription: (value: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: Dispatch<SetStateAction<boolean>>;
  defaultPreviewOnOpen: boolean;
}

// Render block-level markdown as inline-flowing spans so the preview can be
// truncated with line-clamp inside a compact row.
const PREVIEW_COMPONENTS: Components = {
  h1: "span",
  h2: "span",
  h3: "span",
  h4: "span",
  h5: "span",
  h6: "span",
  p: "span",
  li: ({ children, ...props }) => (
    <span {...props}>
      <span aria-hidden="true">&bull; </span>
      {children}{" "}
    </span>
  ),
  ul: "span",
  ol: "span",
  blockquote: "span",
  a: "span",
  img: () => null,
  hr: () => null,
  pre: "span",
};

export function TaskNotesRow({
  description,
  setDescription,
  isPreviewMode,
  setIsPreviewMode,
  defaultPreviewOnOpen,
}: TaskNotesRowProps) {
  const { trigger } = useHaptic();
  const [notesEditorOpen, setNotesEditorOpen] = useState(false);

  const hasDescription = !!description.trim();

  const open = () => {
    trigger("toggle");
    setIsPreviewMode(defaultPreviewOnOpen);
    setNotesEditorOpen(true);
  };

  return (
    <>
      <div className="mx-2">
        <div
          role="button"
          tabIndex={0}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast text-left hover:bg-muted/40 cursor-pointer"
        >
          <IconCell>
            <AlignLeft
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.25}
            />
          </IconCell>
          {hasDescription ? (
            <div className="text-sm flex-1 min-w-0 line-clamp-2 text-foreground prose-sm [&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:text-xs">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={PREVIEW_COMPONENTS}
              >
                {description}
              </ReactMarkdown>
            </div>
          ) : (
            <span className="text-sm flex-1 min-w-0 text-muted-foreground">
              Add details... (Markdown supported)
            </span>
          )}
        </div>
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
