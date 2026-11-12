"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { Send, Save, Trash2, Archive, Palette } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export interface ProjectViewProps {
  mode: "create" | "edit";
  layout?: "sheet" | "panel";
  name: string;
  setName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  projectId?: string;
  isPending?: boolean;
  isValid?: boolean;
  isDirty?: boolean;
  onSubmit: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  errors?: {
    name?: {
      message?: string;
    };
  };
  autoFocusTitle?: boolean;
}

export function ProjectView({
  mode,
  layout = "sheet",
  name,
  setName,
  color,
  setColor,
  projectId,
  isPending = false,
  isValid = true,
  isDirty = true,
  onSubmit,
  onArchive,
  onDelete,
  errors,
  autoFocusTitle,
}: ProjectViewProps) {
  const { trigger } = useHaptic();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isFinePointer = useMediaQuery("(pointer: fine)");

  const nameId = mode === "create" ? "project-name" : "edit-project-name";
  const nameErrorId =
    mode === "create" ? "project-name-error" : "edit-project-name-error";

  const projectBadge =
    mode === "create"
      ? "PROJECT-NEW"
      : projectId
        ? (() => {
            const raw = projectId
              .replace(/^project-/i, "")
              .replace(/-/g, "")
              .toUpperCase();
            return `PROJECT-${raw.slice(0, 4)}`;
          })()
        : "PROJECT-101";

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      if (e.metaKey || e.ctrlKey) {
        if (isValid && (mode === "create" || isDirty) && !isPending) {
          onSubmit();
        }
        return;
      }

      if (!e.shiftKey && !e.altKey) {
        if (isValid && (mode === "create" || isDirty) && !isPending) {
          onSubmit();
        }
      }
    }
  };

  const isSubmitDisabled =
    !isValid || isPending || (mode === "edit" && !isDirty);

  return (
    <div
      className={cn(
        "flex flex-col flex-1 overflow-hidden w-full max-w-full",
        layout === "panel"
          ? "h-full bg-card text-card-foreground"
          : "bg-background text-foreground",
      )}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          if (!isSubmitDisabled) {
            onSubmit();
          }
        }
      }}
    >
      {/* Header: Monospace Domain Badge & Native Title Input */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <span
          data-testid="project-header-badge"
          className="text-[10px] sm:text-xs font-mono uppercase text-brand tracking-wider font-semibold block mb-1.5"
        >
          {projectBadge}
        </span>

        <input
          type="text"
          ref={titleInputRef}
          id={nameId}
          name="name"
          placeholder={
            mode === "create" ? "Work, Personal, School..." : "Project name..."
          }
          aria-label={mode === "create" ? "Project Name" : "Project name"}
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[\r\n]+/g, " "))}
          onKeyDown={handleTitleKeyDown}
          autoFocus={
            autoFocusTitle !== undefined ? autoFocusTitle : isFinePointer
          }
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
            "placeholder:text-muted-foreground text-foreground",
            errors?.name && "placeholder:text-destructive/60",
          )}
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? nameErrorId : undefined}
        />

        {errors?.name?.message && (
          <p id={nameErrorId} className="text-xs text-destructive mt-1">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Main Body: Icon-Led Form Row for ColorPicker ("Ma" Over Borders) */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-2">
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast">
          <IconCell className="pt-[3px] text-muted-foreground">
            <Palette className="h-4 w-4" strokeWidth={2.25} />
          </IconCell>
          <div className="flex-1 min-w-0">
            <ColorPicker
              value={color}
              onChange={(newColor) => {
                setColor(newColor);
              }}
              ariaLabel="Project color"
            />
          </div>
        </div>
      </div>

      {/* Pinned Symmetrical Footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        {/* Left Slot: Lifecycle & Destructive Actions (Edit Mode Only) */}
        <div className="flex items-center gap-1.5">
          {mode === "edit" && onArchive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              onClick={onArchive}
              aria-label="Archive project"
              title="Archive project"
            >
              <Archive className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          )}
          {mode === "edit" && onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-9 w-9 p-0 rounded-lg shadow-sm shadow-destructive/10"
              onClick={onDelete}
              aria-label="Delete project"
              title="Delete project"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          )}
        </div>

        {/* Right Slot: Primary Submission CTA */}
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-colors flex items-center justify-center disabled:opacity-50"
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={isSubmitDisabled}
          aria-label={
            isPending
              ? mode === "create"
                ? "Creating project"
                : "Saving project"
              : mode === "create"
                ? "Create project"
                : "Save project"
          }
        >
          {mode === "create" ? (
            <Send className="h-5 w-5 stroke-[2.25px]" strokeWidth={2.25} />
          ) : (
            <Save
              className={cn(
                "h-5 w-5 stroke-[2.25px]",
                isPending && "opacity-50",
              )}
              strokeWidth={2.25}
            />
          )}
        </Button>
      </div>
    </div>
  );
}
