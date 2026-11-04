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
import { Button } from "@/components/ui/button";
import {
  ListChecks,
  Send,
  Save,
  Trash2,
  Inbox,
  CalendarClock,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { TaskPrioritySelect } from "./shared/TaskPrioritySelect";
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
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // The sheet/panel container submits on Ctrl+Enter too; without this the
      // bubbled event would fire onSubmit twice.
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

  const { data: editSubtaskCount } = useSubtasks(
    mode === "edit" && initialTask ? initialTask.id : undefined,
    { select: (data) => data.length },
  );
  const subtaskCount =
    mode === "create" ? draftSubtasks.length : (editSubtaskCount ?? 0);

  const contentId =
    mode === "create" ? TASK_TITLE_CREATE_ID : TASK_TITLE_EDIT_ID;
  const contentErrorId =
    mode === "create" ? "task-content-error" : "task-content-edit-error";
  const createDatePickerPositioning =
    mode === "create"
      ? { side: "right" as const, align: "center" as const, sideOffset: 15 }
      : {};

  return (
    <div
      className={cn(
        "flex flex-col w-full max-w-full overflow-hidden bg-card text-card-foreground",
        mode === "create"
          ? "h-auto"
          : cn("transition-all", layout === "sheet" ? "h-auto" : "h-full"),
      )}
    >
      <div className="px-4 pt-6 pb-4 border-b border-border/80 shrink-0">
        <textarea
          ref={titleTextareaRef}
          id={contentId}
          placeholder="What needs to be done?"
          aria-label="Task content"
          value={content}
          onChange={(e) => setContent(e.target.value.replace(/[\r\n]+/g, " "))}
          onKeyDown={handleTitleKeyDown}
          autoFocus={
            autoFocusTitle !== undefined ? autoFocusTitle : isFinePointer
          }
          rows={1}
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none resize-none",
            "placeholder:text-muted-foreground/70 text-foreground leading-tight",
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

      <div
        className={cn(
          "flex-1 min-h-0 w-full px-4 py-4 space-y-4",
          mode === "edit" && "overflow-y-auto",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 shrink-0 flex items-center justify-center">
            <SlidersHorizontal
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.25}
            />
          </div>
          <div
            ref={scrollRef}
            className="flex items-center gap-3 overflow-x-auto scrollbar-hide min-w-0 flex-1 py-1 pr-3"
          >
            <TaskDatePicker
              date={dueDate}
              setDate={setDueDate}
              isMobile={isMobile}
              open={datePickerOpen}
              onOpenChange={setDatePickerOpen}
              variant="icon"
              title="Due Date"
              {...createDatePickerPositioning}
              error={!!errors?.due_date}
            />

            <TaskDatePicker
              date={doDate}
              setDate={setDoDate}
              isMobile={isMobile}
              open={doDatePickerOpen}
              onOpenChange={setDoDatePickerOpen}
              variant="icon"
              title="Start Date"
              icon={CalendarClock}
              {...createDatePickerPositioning}
              error={!!errors?.do_date}
              onEveningSelect={() => setIsEvening(true)}
            />

            <div className="shrink-0">
              <TaskPrioritySelect
                priority={priority}
                setPriority={setPriority}
                variant="icon"
                isMobile={isMobile}
              />
            </div>

            <div className="shrink-0">
              <RecurrencePicker
                value={recurrence}
                onChange={setRecurrence}
                variant="icon"
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>

        {(errors?.due_date || errors?.do_date) && (
          <div className="text-[10px] font-bold text-destructive">
            {errors?.due_date?.message || errors?.do_date?.message}
          </div>
        )}

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

        <div>
          <button
            type="button"
            onClick={() => {
              trigger("toggle");
              setShowSubtasks(!showSubtasks);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast text-left",
              "hover:bg-muted/40",
              showSubtasks && "text-brand",
            )}
          >
            <IconCell>
              <ListChecks
                className={cn(
                  "h-4 w-4",
                  showSubtasks ? "text-brand" : "text-muted-foreground",
                )}
                strokeWidth={2.25}
              />
            </IconCell>
            <span className="text-sm flex-1 text-foreground">
              Subtasks
              {subtaskCount > 0 &&
                ` · ${subtaskCount} ${subtaskCount === 1 ? "step" : "steps"}`}
            </span>
          </button>

          <CollapsibleReveal open={showSubtasks}>
            <div className="pl-11 pr-3 pb-2">
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
                  titleTextareaRef.current?.focus();
                }}
                allowReorder
              />
            </div>
          </CollapsibleReveal>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3 p-4 border-t border-border/80 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-card w-full max-w-full">
        <Select
          value={selectedProjectId || "inbox"}
          onValueChange={(v) => {
            trigger("toggle");
            setSelectedProjectId(v === "inbox" ? null : v);
          }}
        >
          <SelectTrigger
            onPointerDown={() => trigger("toggle")}
            className="h-9 w-auto min-w-[130px] max-w-[200px] type-ui border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none transition-all rounded-lg text-foreground [&_svg]:opacity-100 [&_svg]:text-foreground px-3 shrink-0"
          >
            <SelectValue placeholder="Inbox" />
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
                      className="h-3 w-3 rounded-full shrink-0"
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

        <div className="flex-1" />

        {mode === "edit" && (
          <Button
            variant="destructive"
            size="sm"
            className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg shadow-sm shadow-destructive/10 transition-seijaku"
            onClick={() => {
              trigger("thud");
              onDelete();
            }}
            aria-label="Delete task"
          >
            <Trash2 strokeWidth={2.25} />
          </Button>
        )}

        <Button
          size="sm"
          variant={mode === "edit" && isPending ? "ghost" : "default"}
          className={cn(
            "h-9 w-9 p-0 rounded-lg transition-seijaku flex items-center justify-center",
            !(mode === "edit" && isPending) &&
              "bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10",
          )}
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          aria-label={mode === "create" ? "Create task" : "Save changes"}
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
        </Button>
      </div>
    </div>
  );
}
