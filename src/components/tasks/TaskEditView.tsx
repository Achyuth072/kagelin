"use client";

import { Button } from "@/components/ui/button";

import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListChecks,
  Save,
  Trash2,
  Inbox,
  Moon,
  CalendarClock,
  SlidersHorizontal,
  AlignLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { TaskPrioritySelect } from "./shared/TaskPrioritySelect";
import RecurrencePicker from "./TaskSheet/RecurrencePicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Task, Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

import { FieldErrors } from "react-hook-form";
import type { CreateTaskInput } from "@/lib/schemas/task";

interface TaskEditViewProps {
  initialTask: Task;
  content: string;
  setContent: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (value: boolean) => void;
  dueDate: Date | undefined;
  setDueDate: (value: Date | undefined) => void;
  doDate: Date | undefined;
  setDoDate: (value: Date | undefined) => void;
  isEvening: boolean;
  setIsEvening: (value: boolean) => void;
  priority: 1 | 2 | 3 | 4;
  setPriority: (value: 1 | 2 | 3 | 4) => void;
  recurrence: RecurrenceRule | null;
  setRecurrence: (value: RecurrenceRule | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (value: string | null) => void;
  datePickerOpen: boolean;
  setDatePickerOpen: (value: boolean) => void;
  doDatePickerOpen: boolean;
  setDoDatePickerOpen: (value: boolean) => void;
  showSubtasks: boolean;
  setShowSubtasks: (value: boolean) => void;
  draftSubtasks: string[];
  setDraftSubtasks: (value: string[]) => void;
  inboxProjectId: string | null;
  projects: Project[] | undefined;
  isMobile: boolean;
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateTaskInput>;
  mode?: "sheet" | "panel";
}

export function TaskEditView({
  initialTask,
  content,
  setContent,
  description,
  setDescription,
  isPreviewMode,
  setIsPreviewMode,
  dueDate,
  setDueDate,
  doDate,
  setDoDate,
  isEvening,
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
  inboxProjectId,
  projects,
  isMobile,
  hasContent,
  isPending,
  onSubmit,
  onDelete,
  onKeyDown,
  errors,
  mode = "sheet",
}: TaskEditViewProps) {
  const scrollRef = useHorizontalScroll();
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  return (
    <div
      className={cn(
        "flex flex-col w-full max-w-full overflow-hidden transition-all",
        mode === "sheet" ? "h-auto" : "h-full",
      )}
    >
      {/* Title — native textarea, bottom border only, no box */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <textarea
          id="task-content-edit"
          placeholder="What needs to be done?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={isFinePointer}
          rows={1}
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none resize-none",
            "placeholder:text-muted-foreground/50 text-foreground leading-tight",
            errors?.content && "placeholder:text-destructive/60",
          )}
          aria-invalid={!!errors?.content}
          aria-describedby={
            errors?.content ? "task-content-edit-error" : undefined
          }
        />
        {errors?.content && (
          <p
            id="task-content-edit-error"
            className="text-xs text-destructive mt-1"
          >
            {errors.content.message}
          </p>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto py-2">
        {/* Meta row — icon-led horizontal scroll strip */}
        <div className="flex items-center gap-3 px-3 py-2.5 mx-2">
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
              error={!!errors?.do_date}
            />

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-3 text-[13px] bg-background hover:bg-accent border border-input shadow-none hover:text-foreground shrink-0 gap-1.5 rounded-lg transition-all",
                isEvening &&
                  "text-brand bg-brand/10 border-transparent hover:bg-brand/20 hover:text-brand",
              )}
              onClick={() => {
                const nextValue = !isEvening;
                trigger("toggle");
                setIsEvening(nextValue);
                if (nextValue && !doDate) {
                  setDoDate(new Date());
                }
              }}
              title="This Evening"
            >
              <Moon className="h-4 w-4" strokeWidth={2.25} />
              {!isMobile && <span className="font-medium">Evening</span>}
            </Button>

            <div className="shrink-0">
              <TaskPrioritySelect
                priority={priority}
                setPriority={setPriority}
                variant="icon"
              />
            </div>

            <div className="shrink-0">
              <RecurrencePicker
                value={recurrence}
                onChange={setRecurrence}
                variant="icon"
              />
            </div>
          </div>
        </div>

        {(errors?.due_date || errors?.do_date) && (
          <div className="px-3 mx-2 text-[10px] font-bold text-destructive">
            {errors?.due_date?.message || errors?.do_date?.message}
          </div>
        )}

        <div className="h-1" />

        {/* Description */}
        <div className="mx-2">
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast hover:bg-muted/40">
            <IconCell className="pt-[5px]">
              <AlignLeft
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={2.25}
              />
            </IconCell>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground bg-background hover:bg-accent hover:text-accent-foreground border border-input shadow-none transition-all rounded-lg"
                  onClick={() => {
                    trigger("toggle");
                    setIsPreviewMode(!isPreviewMode);
                  }}
                  disabled={!description.trim() && !isPreviewMode}
                >
                  {isPreviewMode ? "Edit" : "Preview"}
                </Button>
              </div>

              {isPreviewMode ? (
                <div className="min-h-[160px] text-[15px] prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {description || "_No description provided._"}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  placeholder="Add details... (Markdown supported)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={4}
                  className="w-full min-h-[120px] text-sm leading-relaxed bg-transparent border-0 outline-none resize-none p-0 text-foreground placeholder:text-muted-foreground/50"
                />
              )}
            </div>
          </div>
        </div>

        <div className="h-1" />

        {/* Subtasks row */}
        <div className="mx-2">
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
            <span className="text-sm flex-1 text-foreground">Subtasks</span>
          </button>

          {showSubtasks && (
            <div className="pl-11 pr-3 pb-2">
              <SubtaskList
                taskId={initialTask.id}
                projectId={initialTask.project_id || inboxProjectId}
                draftSubtasks={draftSubtasks}
                onDraftSubtasksChange={setDraftSubtasks}
              />
            </div>
          )}
        </div>

        <div className="h-1" />
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <Select
          value={selectedProjectId || "inbox"}
          onValueChange={(v) => {
            trigger("toggle");
            setSelectedProjectId(v === "inbox" ? null : v);
          }}
        >
          <SelectTrigger
            onPointerDown={() => trigger("toggle")}
            className="h-9 w-auto min-w-[130px] max-w-[200px] type-ui border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none focus:ring-0 transition-all rounded-lg text-foreground [&_svg]:opacity-100 [&_svg]:text-foreground px-3 shrink-0"
          >
            <SelectValue placeholder="Inbox" />
          </SelectTrigger>
          <SelectContent className="w-(--radix-select-trigger-width) rounded-lg border-border/80 shadow-none [&_[role=option]]:text-[13px] [&_[role=option]]:font-medium [&_[role=option]>span:last-child]:min-w-0">
            <SelectItem value="inbox">
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5" strokeWidth={2.25} />
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
                    <span className="truncate font-medium">{project.name}</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="destructive"
          size="sm"
          className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg shadow-sm shadow-destructive/10 transition-seijaku-fast"
          onClick={() => {
            trigger("thud");
            onDelete();
          }}
          aria-label="Delete task"
        >
          <Trash2 strokeWidth={2.25} />
        </Button>

        <Button
          size="sm"
          variant={isPending ? "ghost" : "default"}
          className={cn(
            "h-9 w-9 p-0 rounded-lg transition-seijaku flex items-center justify-center",
            !isPending &&
              "bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10",
          )}
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          aria-label="Save changes"
        >
          <Save
            className={cn("h-5 w-5 stroke-[2.25px]", isPending && "opacity-50")}
          />
        </Button>
      </div>
    </div>
  );
}
