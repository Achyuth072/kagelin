"use client";

import { FieldErrors } from "react-hook-form";
import { CreateHabitInput } from "@/lib/schemas/habit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { Save, Trash2, CalendarIcon, AlignLeft, Palette } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { HabitIconPicker } from "./shared/HabitIconPicker";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { TaskDatePicker } from "../tasks/shared/TaskDatePicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

import type { Habit } from "@/lib/types/habit";

interface HabitEditViewProps {
  _initialHabit: Habit;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  icon: string;
  setIcon: (value: string) => void;
  startDate: Date | undefined;
  setStartDate: (value: Date | undefined) => void;
  datePickerOpen: boolean;
  setDatePickerOpen: (value: boolean) => void;
  isMobile: boolean;
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateHabitInput>;
}

export function HabitEditView({
  name,
  setName,
  description,
  setDescription,
  color,
  setColor,
  icon,
  setIcon,
  startDate,
  setStartDate,
  datePickerOpen,
  setDatePickerOpen,
  isMobile,
  hasContent,
  isPending,
  onSubmit,
  onDelete,
  onKeyDown,
  errors,
}: HabitEditViewProps) {
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  return (
    <div className="flex flex-col flex-1 overflow-hidden w-full max-w-full">
      {/* Title — native input, bottom border only, no box */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <input
          id="habit-name-edit"
          placeholder="Habit name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={isFinePointer}
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
            "placeholder:text-muted-foreground/50 text-foreground",
            errors?.name && "placeholder:text-destructive/60",
          )}
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? "habit-name-edit-error" : undefined}
        />
        {errors?.name && (
          <p
            id="habit-name-edit-error"
            className="text-xs text-destructive mt-1"
          >
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        {/* Icon & color */}
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md mx-2">
          <IconCell>
            <Palette
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.25}
            />
          </IconCell>
          <div className="flex-1 min-w-0 space-y-3">
            <HabitIconPicker value={icon} onChange={setIcon} />
            <ColorPicker
              value={color}
              onChange={setColor}
              ariaLabel="Habit color"
            />
          </div>
        </div>

        <div className="h-1" />

        {/* Description */}
        <div className="mx-2">
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast">
            <IconCell className="pt-[5px]">
              <AlignLeft
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={2.25}
              />
            </IconCell>
            <textarea
              id="habit-description-edit"
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex-1 bg-transparent border-0 outline-none resize-none text-[15px] text-foreground placeholder:text-muted-foreground/60 leading-relaxed p-0 min-h-[48px]"
            />
          </div>
        </div>

        <div className="h-1" />
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <TaskDatePicker
          date={startDate}
          setDate={setStartDate}
          isMobile={isMobile}
          open={datePickerOpen}
          onOpenChange={setDatePickerOpen}
          variant="icon"
          icon={CalendarIcon}
          title="Start date"
          showTime={true}
          allowPastDates={true}
          side="top"
          align="start"
          sideOffset={15}
        />

        <div className="flex-1" />

        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg shadow-sm shadow-destructive/10 transition-seijaku-fast"
          onClick={() => {
            trigger("thud");
            onDelete();
          }}
          disabled={isPending}
          aria-label="Delete habit"
        >
          <Trash2 strokeWidth={2.25} />
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          aria-label={isPending ? "Saving" : "Save changes"}
        >
          <Save className="h-5 w-5 stroke-[2.25px]" />
        </Button>
      </div>
    </div>
  );
}
