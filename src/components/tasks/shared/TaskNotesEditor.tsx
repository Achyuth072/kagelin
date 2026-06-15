"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Italic, List, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

interface ToolbarAction {
  label: string;
  icon: typeof Bold;
  apply: (selected: string) => string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "Bold", icon: Bold, apply: (s) => `**${s || "bold"}**` },
  { label: "Italic", icon: Italic, apply: (s) => `_${s || "italic"}_` },
  {
    label: "List",
    icon: List,
    apply: (s) =>
      s
        ? s
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n")
        : "- ",
  },
  {
    label: "Link",
    icon: LinkIcon,
    apply: (s) => `[${s || "link text"}](url)`,
  },
];

interface TaskNotesEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  setDescription: (value: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: Dispatch<SetStateAction<boolean>>;
}

export function TaskNotesEditor({
  open,
  onOpenChange,
  description,
  setDescription,
  isPreviewMode,
  setIsPreviewMode,
}: TaskNotesEditorProps) {
  const { trigger } = useHaptic();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyToolbarAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const replacement = action.apply(selected);

    setDescription(
      value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex flex-col h-auto max-h-[85dvh] overflow-hidden sm:h-[85vh] sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <div
            className={cn(
              "flex items-center justify-between gap-3",
              !isMobile && "pr-10",
            )}
          >
            <ResponsiveDialogTitle>Notes</ResponsiveDialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground bg-background hover:bg-accent hover:text-accent-foreground border border-input shadow-none transition-all rounded-lg"
              onClick={() => {
                trigger("toggle");
                setIsPreviewMode((prev) => !prev);
              }}
            >
              {isPreviewMode ? "Edit" : "Preview"}
            </Button>
          </div>
        </ResponsiveDialogHeader>

        <div className="flex-1 min-h-[40vh] flex flex-col px-4 pb-4">
          <div
            hidden={!isPreviewMode}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto text-[15px] prose prose-sm dark:prose-invert max-w-none",
              !isPreviewMode && "hidden",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {description || "_No description provided._"}
            </ReactMarkdown>
          </div>
          <div
            hidden={isPreviewMode}
            className={cn(
              "flex flex-col flex-1 min-h-0 gap-2",
              isPreviewMode && "hidden",
            )}
          >
            <div className="flex items-center gap-1">
              {TOOLBAR_ACTIONS.map(({ label, icon: Icon, apply }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={label}
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    trigger("toggle");
                    applyToolbarAction({ label, icon: Icon, apply });
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              aria-label="Notes"
              placeholder="Add details... (Markdown supported)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full flex-1 min-h-0 overflow-y-auto text-sm leading-relaxed bg-transparent border-0 outline-none resize-none p-0 text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
