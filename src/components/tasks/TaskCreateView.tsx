"use client";

import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
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
  Inbox,
  Moon,
  CalendarClock,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { TaskPrioritySelect } from "./shared/TaskPrioritySelect";
import RecurrencePicker from "./TaskSheet/RecurrencePicker";
import type { Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

import { FieldErrors } from "react-hook-form";
import type { CreateTaskInput } from "@/lib/schemas/task";

interface TaskCreateViewProps {
  content: string;
  setContent: (value: string) => void;
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
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateTaskInput>;
}

export function TaskCreateView({
  content,
  setContent,
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
  onKeyDown,
  errors,
}: TaskCreateViewProps) {
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const scrollRef = useHorizontalScroll();

  return (
    <div className="flex flex-col h-auto w-full max-w-full overflow-hidden">
      {/* Title — native textarea, bottom border only, no box */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <textarea
          id="task-content"
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
          aria-describedby={errors?.content ? "task-content-error" : undefined}
        />
        {errors?.content && (
          <p id="task-content-error" className="text-xs text-destructive mt-1">
            {errors.content.message}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 py-2">
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
              side="right"
              align="center"
              sideOffset={15}
              error={!!errors?.due_date}
            />

            <TaskDatePicker
              date={doDate}
              setDate={setDoDate}
              isMobile={isMobile}
              open={doDatePickerOpen}
              onOpenChange={setDoDatePickerOpen}
              variant="icon"
              title={!isMobile ? "Start Date" : undefined}
              icon={CalendarClock}
              side="right"
              align="center"
              sideOffset={15}
              error={!!errors?.do_date}
            />

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-3 transition-all text-muted-foreground hover:text-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none gap-1.5 shrink-0 rounded-lg",
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
              title={!isMobile ? "This Evening" : undefined}
              aria-label="This Evening"
            >
              <Moon strokeWidth={2.25} className="h-4 w-4" />
              {!isMobile && <span className="type-ui">Evening</span>}
            </Button>

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
          <div className="px-3 mx-2 text-[10px] font-bold text-destructive">
            {errors?.due_date?.message || errors?.do_date?.message}
          </div>
        )}

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
                taskId={undefined}
                projectId={inboxProjectId}
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
          <SelectContent className="w-(--radix-select-trigger-width) rounded-lg border-border/80 shadow-2xl [&_[role=option]]:text-[13px] [&_[role=option]]:font-medium [&_[role=option]>span:last-child]:min-w-0">
            <SelectItem value="inbox">
              <div className="flex items-center gap-2">
                <Inbox strokeWidth={2.25} className="h-4 w-4" />
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
          size="sm"
          className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          aria-label="Create task"
        >
          <Send className="h-5 w-5 stroke-[2.25px]" />
        </Button>
      </div>
    </div>
  );
}
