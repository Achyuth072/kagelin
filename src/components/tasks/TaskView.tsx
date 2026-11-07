"use client";

import { useRef } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { CollapsibleReveal } from "./shared/CollapsibleReveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CalendarClock,
  Folder,
  Inbox,
  ListTodo,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconCell } from "@/components/ui/IconCell";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { PriorityGlyph } from "./PriorityGlyph";
import { TaskNotesRow, type TaskNotesRowHandle } from "./shared/TaskNotesRow";
import RecurrencePicker from "./TaskSheet/RecurrencePicker";
import { ReadableText } from "@/components/encryption/ReadableText";
import { isUnreadable } from "@/lib/crypto/unreadable";
import { TASK_TITLE_CREATE_ID, TASK_TITLE_EDIT_ID } from "./task-utils";
import { useTaskEditorContext } from "./TaskEditorProvider";

export interface TaskViewProps {
  layout?: "sheet" | "panel";
}

export function TaskView({ layout = "sheet" }: TaskViewProps = {}) {
  const {
    mode,
    task: initialTask,
    content,
    setContent,
    description,
    setDescription,
    dueDate,
    setDueDate,
    doDate,
    setDoDate,
    setIsEvening,
    priority,
    setPriority,
    recurrence,
    setRecurrence,
    selectedProjectId,
    setSelectedProjectId,
    datePickerOpen,
    setDatePickerOpen,
    doDatePickerOpen,
    setDoDatePickerOpen,
    showSubtasks,
    setShowSubtasks,
    draftSubtasks,
    setDraftSubtasks,
    pendingStep,
    setPendingStep,
    inboxProjectId,
    projects,
    isMobile,
    hasContent,
    isPending,
    onSubmit,
    onDeleteRequest: onDelete,
    onKeyDown,
    errors,
    autoFocusTitle,
  } = useTaskEditorContext();

  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const scrollRef = useHorizontalScroll();
  const notesRowRef = useRef<TaskNotesRowHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Stop Enter from bubbling to the container which also listens for Cmd+Enter
      e.stopPropagation();

      if (e.metaKey || e.ctrlKey) {
        onSubmit();
        return;
      }

      if (!e.shiftKey && !e.altKey) {
        onSubmit();
      }
      return;
    }

    onKeyDown(e);
  };

  const handleTitlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData("text");
    if (text && /[\r\n]/.test(text)) {
      e.preventDefault();
      const sanitized = text.replace(/[\r\n]+/g, " ");
      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const nextValue =
        input.value.slice(0, start) + sanitized + input.value.slice(end);
      setContent(nextValue);
    }
  };

  const { data: editSubtasks = [] } = useSubtasks(
    mode === "edit" && initialTask ? initialTask.id : undefined,
  );
  const doneSubtaskCount =
    mode === "edit" ? editSubtasks.filter((s) => s.is_completed).length : 0;
  const totalSubtaskCount =
    mode === "create" ? draftSubtasks.length : editSubtasks.length;

  const contentId =
    mode === "create" ? TASK_TITLE_CREATE_ID : TASK_TITLE_EDIT_ID;
  const contentErrorId =
    mode === "create" ? "task-content-error" : "task-content-edit-error";
  const createDatePickerPositioning =
    mode === "create"
      ? { side: "right" as const, align: "center" as const, sideOffset: 15 }
      : {};

  const taskIdBadge =
    mode === "create"
      ? "TASK-NEW"
      : initialTask?.id
        ? (() => {
            const raw = initialTask.id
              .replace(/^task-/i, "")
              .replace(/-/g, "")
              .toUpperCase();
            return `TASK-${raw.slice(0, 4)}`;
          })()
        : "TASK-102";

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <div
      className={cn(
        "flex flex-col w-full max-w-full overflow-hidden",
        layout === "panel"
          ? "bg-card text-card-foreground"
          : "bg-background text-foreground",
        mode === "create"
          ? "h-auto"
          : cn("transition-all", layout === "sheet" ? "h-auto" : "h-full"),
      )}
    >
      {/* Title Input — unboxed native input, border-b (FORM_PATTERNS.md lines 35-39) */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <span
          data-testid="task-header-badge"
          className="text-[10px] font-mono uppercase text-brand tracking-wider font-semibold block mb-0.5"
        >
          {taskIdBadge}
        </span>
        <input
          type="text"
          ref={titleInputRef}
          id={contentId}
          placeholder="What needs to be done?"
          aria-label="Task content"
          value={content}
          onChange={(e) => setContent(e.target.value.replace(/[\r\n]+/g, " "))}
          onKeyDown={handleTitleKeyDown}
          onPaste={handleTitlePaste}
          autoFocus={
            autoFocusTitle !== undefined ? autoFocusTitle : isFinePointer
          }
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-b border-border/40 pb-2 pt-0.5 outline-none placeholder:text-muted-foreground/50 text-foreground",
            errors?.content && "placeholder:text-destructive/60",
          )}
          aria-invalid={!!errors?.content}
          aria-describedby={errors?.content ? contentErrorId : undefined}
        />
        {errors?.content && (
          <p id={contentErrorId} className="text-xs text-destructive mt-1">
            {errors.content.message}
          </p>
        )}
      </div>

      {/* Property Strip — Dates & Priority in a Single Horizontal Line with Mouse Wheel / Momentum Scroll */}
      <div className="px-4 py-1.5 flex items-center gap-2.5 shrink-0">
        <div className="w-5 shrink-0 flex items-center justify-center text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <div
          ref={scrollRef}
          data-testid="property-strip"
          className="py-1 px-0.5 flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0 flex-1 pr-2"
        >
          {/* Do Date Chip */}
          <TaskDatePicker
            date={doDate}
            setDate={setDoDate}
            isMobile={isMobile}
            open={doDatePickerOpen}
            onOpenChange={setDoDatePickerOpen}
            variant="chip"
            title="Do Date"
            icon={CalendarClock}
            {...createDatePickerPositioning}
            error={!!errors?.do_date}
            onEveningSelect={() => setIsEvening(true)}
          />

          {/* Due Date Chip */}
          <TaskDatePicker
            date={dueDate}
            setDate={setDueDate}
            isMobile={isMobile}
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            variant="chip"
            title="Due Date"
            icon={Calendar}
            {...createDatePickerPositioning}
            error={!!errors?.due_date}
          />

          {/* Priority Segmented Toggle */}
          <div
            role="group"
            aria-label="Priority"
            data-testid="priority-segmented-toggle"
            className="flex items-center gap-1 bg-secondary/50 rounded-md p-0.5 border border-border/50 shrink-0"
          >
            {([1, 2, 3, 4] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  trigger("tick");
                  setPriority(p);
                }}
                aria-label={`Priority P${p}`}
                aria-pressed={priority === p}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-colors",
                  priority === p
                    ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PriorityGlyph level={p} />
                <span>P{p}</span>
              </button>
            ))}
          </div>

          {/* Repeat / Recurrence Chip */}
          <RecurrencePicker
            value={recurrence}
            onChange={setRecurrence}
            variant="chip"
            isMobile={isMobile}
          />
        </div>
      </div>

      {(errors?.due_date || errors?.do_date) && (
        <div className="px-4 text-[10px] font-bold text-destructive">
          {errors?.due_date?.message || errors?.do_date?.message}
        </div>
      )}

      {/* Main Body: Steps Checklist & Notes */}
      <div
        className={cn(
          "flex-1 min-h-0 w-full px-4 py-2 space-y-1",
          mode === "edit" && "overflow-y-auto",
        )}
      >
        {/* Row 1: Steps Checklist */}
        <div className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors">
          <IconCell className="text-muted-foreground">
            <ListTodo className="h-4 w-4" strokeWidth={2.25} />
          </IconCell>
          <div className="flex-1 text-xs space-y-2">
            <button
              type="button"
              onClick={() => {
                trigger("toggle");
                setShowSubtasks(!showSubtasks);
              }}
              aria-label={`Steps (${doneSubtaskCount}/${totalSubtaskCount})`}
              className="flex items-center justify-between w-full text-left cursor-pointer select-none"
            >
              <span className="text-muted-foreground font-medium">
                Steps ({doneSubtaskCount}/{totalSubtaskCount})
              </span>
            </button>
            <CollapsibleReveal open={showSubtasks}>
              <div className="space-y-1.5 pt-1">
                <SubtaskList
                  taskId={
                    mode === "edit" && initialTask ? initialTask.id : undefined
                  }
                  projectId={
                    mode === "edit" && initialTask
                      ? initialTask.project_id || inboxProjectId
                      : inboxProjectId
                  }
                  draftSubtasks={draftSubtasks}
                  onDraftSubtasksChange={setDraftSubtasks}
                  pendingContent={pendingStep}
                  onPendingContentChange={setPendingStep}
                  onCollapse={() => {
                    setShowSubtasks(false);
                    titleInputRef.current?.focus();
                  }}
                  allowReorder
                />
              </div>
            </CollapsibleReveal>
          </div>
        </div>

        {/* Logical Ma spacer (FORM_PATTERNS.md line 80) */}
        <div className="h-1" />

        {/* Row 2: Notes Textarea */}
        <TaskNotesRow
          ref={notesRowRef}
          description={description}
          setDescription={setDescription}
          unreadable={
            mode === "edit" && initialTask
              ? isUnreadable(initialTask, "description")
              : false
          }
        />
      </div>

      {/* Anchored Footer — Project Selector on Left, Action CTAs on Right */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] w-full max-w-full",
          layout === "panel" ? "bg-card" : "bg-background",
        )}
      >
        {/* Project Selector anchored in footer */}
        <Select
          value={selectedProjectId || "inbox"}
          onValueChange={(v) => {
            trigger("toggle");
            setSelectedProjectId(v === "inbox" ? null : v);
          }}
        >
          <SelectTrigger
            onPointerDown={() => trigger("toggle")}
            className="flex items-center gap-2 bg-secondary/40 hover:bg-secondary/60 border border-border/50 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors max-w-[180px] h-9 shadow-none text-foreground [&>svg]:opacity-100 [&>svg]:text-foreground shrink-0"
          >
            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor:
                  selectedProject?.color ?? "hsl(var(--muted-foreground))",
              }}
            />
            <span className="truncate font-medium">
              <SelectValue placeholder="Inbox" />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "w-(--radix-select-trigger-width) rounded-lg border-border/80 [&_[role=option]]:text-[13px] [&_[role=option]]:font-medium [&_[role=option]>span:last-child]:min-w-0",
              mode === "create" ? "shadow-2xl" : "shadow-none",
            )}
          >
            <SelectItem value="inbox">
              <div className="flex items-center gap-2">
                <Inbox
                  strokeWidth={2.25}
                  className={mode === "create" ? "h-4 w-4" : "h-3.5 w-3.5"}
                />
                <span className="font-medium">Inbox</span>
              </div>
            </SelectItem>
            {projects
              ?.filter((p) => !p.is_inbox)
              .map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2 min-w-0 w-full">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate font-medium">
                      <ReadableText text={project.name} />
                    </span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => {
                trigger("thud");
                onDelete();
              }}
              aria-label="Delete task"
              title="Delete task"
              className="h-9 w-9 p-0 shadow-sm shadow-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <button
            type="button"
            onClick={() => {
              trigger("success");
              onSubmit();
            }}
            disabled={!hasContent || isPending}
            aria-label={mode === "create" ? "Create task" : "Save changes"}
            title={mode === "create" ? "Create task" : "Save changes"}
            className={cn(
              "h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-colors flex items-center justify-center disabled:opacity-50",
            )}
          >
            {mode === "create" ? (
              <Send className="h-5 w-5 stroke-[2.25px]" />
            ) : (
              <Save
                className={cn(
                  "h-5 w-5 stroke-[2.25px]",
                  isPending && "opacity-50",
                )}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
