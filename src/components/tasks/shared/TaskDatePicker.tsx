"use client";

import { format } from "date-fns";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { categorizeTaskSchedule } from "@/lib/utils/task-metrics";

interface TaskDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "icon" | "compact" | "chip";
  title?: string;
  description?: string;
  activeClassName?: string;
  icon?: LucideIcon;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  showTime?: boolean;
  allowPastDates?: boolean;
  error?: boolean;
  onEveningSelect?: () => void;
  allowClear?: boolean;
  isCompleted?: boolean;
}

export function TaskDatePicker({
  date,
  setDate,
  isMobile,
  open,
  onOpenChange,
  variant = "icon",
  title = "Due Date",
  description,
  activeClassName = "text-brand bg-brand/10 hover:bg-brand/20 hover:text-brand",
  icon: Icon = CalendarIcon,
  side = "bottom",
  sideOffset = 4,
  align = "center",

  showTime = true,
  allowPastDates = false,
  error = false,
  onEveningSelect,
  allowClear = true,
  isCompleted = false,
}: TaskDatePickerProps) {
  const isCompact = variant === "compact";
  const isChip = variant === "chip";
  const isDoDate = title === "Do Date" || title.toLowerCase().includes("start");
  const scheduleCategory = date
    ? categorizeTaskSchedule(
        isDoDate
          ? { do_date: date.toISOString(), is_completed: isCompleted }
          : { due_date: date.toISOString(), is_completed: isCompleted },
      )
    : "unscheduled";
  const isOverdue = scheduleCategory === "overdue";
  const isDoDateToday = isDoDate && scheduleCategory === "planned_today";
  const isDoDateReschedule =
    isDoDate && scheduleCategory === "reschedule_needed";
  const isHighlighted = isDoDateToday || isOverdue;

  const effectiveDescription =
    description ??
    (isDoDate
      ? "Operational schedule (when to work on it)"
      : title.toLowerCase().includes("due")
        ? "Deadline (external commitment)"
        : undefined);
  const { trigger } = useHaptic();
  const { formatDateWithTime } = useTimeFormat();

  const prefix = isDoDate
    ? "Do"
    : title.toLowerCase().includes("due")
      ? "Due"
      : title;

  const formattedDate = date
    ? showTime
      ? formatDateWithTime(date, "MMM d")
      : format(date, "MMMM d, yyyy")
    : null;

  const buttonContent = isChip ? (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isDoDateToday ? "text-foreground" : "text-muted-foreground",
          error && "text-destructive",
        )}
      />
      <span className="truncate max-w-[130px] sm:max-w-none">
        {prefix}: {date ? formattedDate : "None"}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <Icon
        strokeWidth={2.25}
        className={cn(
          isCompact
            ? "h-5 w-5"
            : "h-5 w-5 transition-all text-muted-foreground",
          date && (isCompact ? "mr-1 h-4 w-4" : "text-primary"),
          error && "text-destructive",
        )}
      />
      {date ? (
        <span
          className={cn(
            "text-sm font-medium",
            isCompact ? "" : "ml-0.5",
            error && "text-destructive",
          )}
        >
          {prefix}: {formattedDate}
        </span>
      ) : (
        <span
          className={cn(
            "text-xs sm:text-sm font-medium",
            isCompact ? "" : "ml-0.5",
            error && "text-destructive",
          )}
        >
          {title}
        </span>
      )}
    </div>
  );

  const buttonTitle = `Set ${title.toLowerCase()}`;
  const buttonAriaLabel = date
    ? `${title}: ${formattedDate}`
    : `Set ${title.toLowerCase()}`;

  const hasChipClear = isChip && !!date && allowClear;

  const buttonClassName = isChip
    ? cn(
        "inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium px-2.5 py-1 border transition-colors shrink-0 h-7 sm:h-8 shadow-none",
        isHighlighted
          ? "bg-secondary/70 border-border/80 font-semibold text-foreground"
          : isDoDateReschedule
            ? "bg-secondary/40 border-border/60 text-muted-foreground border-dashed"
            : "bg-secondary/40 hover:bg-secondary/60 border-border/50 text-foreground",
        hasChipClear
          ? "rounded-l-md rounded-r-none border-r-0 pr-2"
          : "rounded-md",
        error && "border-destructive text-destructive",
      )
    : cn(
        "h-9 transition-all shrink-0 group [&_svg]:!size-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none",
        error &&
          "border-destructive-surface-border bg-destructive-surface text-destructive hover:bg-destructive-surface-hover hover:text-destructive",
        isCompact
          ? cn(
              "w-auto px-2.5 text-muted-foreground hover:text-foreground",
              date && cn("border-transparent", activeClassName),
            )
          : cn(
              "w-auto px-2.5 sm:px-3 text-muted-foreground hover:text-foreground hover:bg-accent",
              date &&
                cn("hover:bg-transparent border-transparent", activeClassName),
            ),
      );

  const clearButton =
    allowClear && date ? (
      <button
        type="button"
        tabIndex={0}
        title={`Clear ${title.toLowerCase()}`}
        aria-label={`Clear ${title.toLowerCase()}`}
        className={
          isChip
            ? cn(
                "inline-flex items-center justify-center h-7 sm:h-8 px-1.5 rounded-r-md rounded-l-none border border-l transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isHighlighted
                  ? "bg-secondary/70 border-border/80 hover:bg-secondary/90 border-l-border/60 text-foreground"
                  : "bg-secondary/40 hover:bg-secondary/60 border-border/50 border-l-border/30 text-muted-foreground hover:text-foreground",
                error && "border-destructive text-destructive",
              )
            : cn(
                "relative ml-1 p-0.5 rounded cursor-pointer before:absolute before:-inset-2 before:content-[''] transition-colors",
                isCompact
                  ? "hover:bg-destructive-surface-hover text-muted-foreground hover:text-destructive"
                  : "rounded-full hover:bg-current/10",
                error && "hover:bg-destructive-surface-hover",
              )
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          trigger("toggle");
          setDate(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            trigger("toggle");
            setDate(undefined);
          }
        }}
      >
        <X
          className={cn(
            "h-3 w-3",
            !isChip && isCompact && "hover:text-destructive",
          )}
          strokeWidth={2.25}
        />
      </button>
    ) : null;

  if (isMobile) {
    return (
      <div className="inline-flex items-center">
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              trigger("toggle");
              onOpenChange(true);
            }}
            className={buttonClassName}
            title={buttonTitle}
            aria-label={buttonAriaLabel}
          >
            {buttonContent}
          </Button>
          <ResponsiveDialogContent
            className={cn(
              "w-full p-0",
              !isCompact &&
                "max-w-[320px] mx-auto h-auto rounded-[10px] mb-4 bg-popover [&>div.h-2]:hidden",
            )}
          >
            <ResponsiveDialogHeader className="sr-only">
              <ResponsiveDialogTitle>Set {title}</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <DateTimeWizard
              title={`Set ${title}`}
              description={effectiveDescription}
              date={date}
              setDate={setDate}
              onClose={() => onOpenChange(false)}
              showTime={showTime}
              allowPastDates={allowPastDates}
              onEveningSelect={onEveningSelect}
              allowClear={allowClear}
            />
          </ResponsiveDialogContent>
        </ResponsiveDialog>
        {clearButton}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={buttonClassName}
            title={buttonTitle}
            aria-label={buttonAriaLabel}
          >
            {buttonContent}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-none"
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={16}
        >
          <DateTimeWizard
            title={`Set ${title}`}
            description={effectiveDescription}
            date={date}
            setDate={setDate}
            onClose={() => onOpenChange(false)}
            showTime={showTime}
            allowPastDates={allowPastDates}
            onEveningSelect={onEveningSelect}
            allowClear={allowClear}
          />
        </PopoverContent>
      </Popover>
      {clearButton}
    </div>
  );
}
