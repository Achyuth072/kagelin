"use client";

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { AlignLeft } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { IconCell } from "@/components/ui/IconCell";
import { ReadableText } from "@/components/encryption/ReadableText";
import { cn } from "@/lib/utils";

export interface TaskNotesRowHandle {
  focus: () => void;
}

interface TaskNotesRowProps {
  description: string;
  setDescription: (value: string) => void;
  unreadable?: boolean;
}

export function parseLinkTokens(text: string): ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const isMarkdown = Boolean(match[1] && match[2]);
    let url = isMarkdown ? match[2] : match[3];
    let label = isMarkdown ? match[1] : "";
    let trailingPunct = "";

    if (!isMarkdown) {
      const punctMatch = url.match(/[.,;:!?]+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        url = url.slice(0, -trailingPunct.length);
      }
      label = url;
    }

    elements.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand underline hover:text-brand/80"
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>,
    );

    if (trailingPunct) {
      elements.push(trailingPunct);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

export const TaskNotesRow = forwardRef<TaskNotesRowHandle, TaskNotesRowProps>(
  function TaskNotesRow(
    { description, setDescription, unreadable = false },
    ref,
  ) {
    const { trigger } = useHaptic();
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const hasDescription = !!description.trim();
    const showPreview = hasDescription && !isEditing;

    const startEditing = () => {
      trigger("toggle");
      setIsEditing(true);
    };

    useImperativeHandle(ref, () => ({
      focus: () => {
        setIsEditing(true);
        textareaRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (isEditing) {
        textareaRef.current?.focus();
      }
    }, [isEditing]);

    return (
      <div className="mx-2">
        <div
          className="flex items-start gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast hover:bg-muted/40 cursor-text"
          onClick={() => {
            if (!unreadable && !isEditing) {
              startEditing();
            }
          }}
        >
          <IconCell className="pt-[5px]">
            <AlignLeft
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.25}
            />
          </IconCell>
          {unreadable ? (
            <span className="text-sm flex-1 min-w-0">
              <ReadableText text={null} />
            </span>
          ) : (
            <>
              {showPreview && (
                <div
                  className="text-sm flex-1 min-w-0 text-foreground whitespace-pre-wrap break-words leading-normal"
                  tabIndex={0}
                  role="button"
                  aria-label="Edit notes"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      startEditing();
                    }
                  }}
                >
                  {parseLinkTokens(description)}
                </div>
              )}
              <textarea
                ref={textareaRef}
                id="task-description"
                aria-label="Notes"
                placeholder="Add notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                rows={1}
                hidden={showPreview}
                className={cn(
                  "flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/70 leading-normal p-0 min-h-6 field-sizing-content max-h-32",
                  showPreview && "hidden",
                )}
              />
            </>
          )}
        </div>
      </div>
    );
  },
);
