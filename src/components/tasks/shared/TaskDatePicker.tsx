"use client";

import { format, isBefore, isToday, startOfDay } from "date-fns";
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

interface TaskDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "icon" | "compact" | "chip";
  title?: string;
  activeClassName?: string;
  icon?: LucideIcon;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  showTime?: boolean;
  allowPastDates?: boolean;
  error?: boolean;
  onEveningSelect?: () => void;
}

export function TaskDatePicker({
  date,
  setDate,
  isMobile,
  open,
  onOpenChange,
  variant = "icon",
  title = "Due Date",
  activeClassName = "text-brand bg-brand/10 hover:bg-brand/20 hover:text-brand",
  icon: Icon = CalendarIcon,
  side = "bottom",
  sideOffset = 4,
  align = "center",

  showTime = true,
  allowPastDates = false,
  error = false,
  onEveningSelect,
}: TaskDatePickerProps) {
  const isCompact = variant === "compact";
  const isChip = variant === "chip";
  const isDoDate = title === "Do Date" || title.toLowerCase().includes("start");
  const isOverdue =
    !isDoDate && !!date && isBefore(date, startOfDay(new Date()));
  const isDoDateToday = isDoDate && !!date && isToday(date);
  const isHighlighted = isDoDateToday || isOverdue;
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
    <div className="flex items-center gap-1.5">
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          isDoDateToday ? "text-foreground" : "text-muted-foreground",
          error && "text-destructive",
        )}
      />
      <span>
        {prefix}: {date ? formattedDate : "None"}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <Icon
        strokeWidth={1.5}
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

  const buttonClassName = isChip
    ? cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors shrink-0 h-auto shadow-none",
        isHighlighted
          ? "bg-secondary/70 border-border/80 font-semibold text-foreground"
          : "bg-secondary/40 hover:bg-secondary/60 border-border/50 text-foreground",
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
    !isChip && date ? (
      <button
        type="button"
        title={`Clear ${title.toLowerCase()}`}
        aria-label={`Clear ${title.toLowerCase()}`}
        className={cn(
          "relative ml-1 p-0.5 rounded cursor-pointer before:absolute before:-inset-2 before:content-['']",
          isCompact
            ? "hover:bg-destructive-surface-hover"
            : "rounded-full hover:bg-current/10",
          error && "hover:bg-destructive-surface-hover",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          trigger("toggle");
          setDate(undefined);
        }}
      >
        <X className={cn("h-3 w-3", isCompact && "hover:text-destructive")} />
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
              date={date}
              setDate={setDate}
              onClose={() => onOpenChange(false)}
              showTime={showTime}
              allowPastDates={allowPastDates}
              onEveningSelect={onEveningSelect}
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
          className="w-auto p-0 border-none shadow-xl"
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={16}
        >
          <DateTimeWizard
            title={`Set ${title}`}
            date={date}
            setDate={setDate}
            onClose={() => onOpenChange(false)}
            showTime={showTime}
            allowPastDates={allowPastDates}
            onEveningSelect={onEveningSelect}
          />
        </PopoverContent>
      </Popover>
      {clearButton}
    </div>
  );
}
