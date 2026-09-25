"use client";

import { FieldErrors } from "react-hook-form";
import { CreateHabitInput } from "@/lib/schemas/habit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import {
  Send,
  Save,
  Trash2,
  Archive,
  CalendarIcon,
  AlignLeft,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { CollapsibleReveal } from "../tasks/shared/CollapsibleReveal";
import { HabitDisclosureRow } from "./shared/HabitDisclosureRow";
import { HabitAppearanceField } from "./shared/HabitAppearanceField";
import {
  HabitFrequencyField,
  type FrequencyPeriod,
} from "./shared/HabitFrequencyField";
import { HabitTargetField, type TargetType } from "./shared/HabitTargetField";
import { HabitQuestionField } from "./shared/HabitQuestionField";
import { HabitTypeToggle } from "./shared/HabitTypeToggle";
import type { HabitType } from "@/lib/types/habit";
import { HabitReminderField } from "./shared/HabitReminderField";
import { TaskDatePicker } from "../tasks/shared/TaskDatePicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface HabitViewBaseProps {
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
  habitType: HabitType;
  setHabitType: (value: HabitType) => void;
  frequencyCount: number;
  setFrequencyCount: (value: number) => void;
  frequencyPeriod: FrequencyPeriod | null | undefined;
  setFrequencyPeriod: (value: FrequencyPeriod | null) => void;
  frequencyDays: number | undefined;
  setFrequencyDays: (value: number | undefined) => void;
  targetValue: number | undefined;
  setTargetValue: (value: number | undefined) => void;
  targetType: TargetType;
  setTargetType: (value: TargetType) => void;
  unit: string;
  setUnit: (value: string) => void;
  question: string;
  setQuestion: (value: string) => void;
  reminderTime: string | null | undefined;
  setReminderTime: (value: string | null) => void;
  reminderDays: number;
  setReminderDays: (value: number) => void;
  datePickerOpen: boolean;
  setDatePickerOpen: (value: boolean) => void;
  isMobile: boolean;
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateHabitInput>;
}

export type HabitViewProps =
  | (HabitViewBaseProps & { mode: "create" })
  | (HabitViewBaseProps & {
      mode: "edit";
      onArchive: () => void;
      onDelete: () => void;
    });

export function HabitView(props: HabitViewProps) {
  const { mode } = props;
  const {
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
    habitType,
    setHabitType,
    frequencyCount,
    setFrequencyCount,
    frequencyPeriod,
    setFrequencyPeriod,
    frequencyDays,
    setFrequencyDays,
    targetValue,
    setTargetValue,
    targetType,
    setTargetType,
    unit,
    setUnit,
    question,
    setQuestion,
    reminderTime,
    setReminderTime,
    reminderDays,
    setReminderDays,
    datePickerOpen,
    setDatePickerOpen,
    isMobile,
    hasContent,
    isPending,
    onSubmit,
    onKeyDown,
    errors,
  } = props;

  const { trigger } = useHaptic();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreSummary = [
    question.trim() && "Question",
    reminderTime && "Reminder",
    description.trim() && "Notes",
  ]
    .filter(Boolean)
    .join(" · ");
  const isFinePointer = useMediaQuery("(pointer: fine)");

  const nameId = mode === "create" ? "habit-name" : "habit-name-edit";
  const nameErrorId =
    mode === "create" ? "habit-name-error" : "habit-name-edit-error";
  const descriptionId =
    mode === "create" ? "habit-description" : "habit-description-edit";

  return (
    <div className="flex flex-col flex-1 overflow-hidden w-full max-w-full">
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <input
          id={nameId}
          placeholder="Habit name"
          aria-label="Habit name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={isFinePointer}
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
            "placeholder:text-muted-foreground text-foreground",
            errors?.name && "placeholder:text-destructive/60",
          )}
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? nameErrorId : undefined}
        />
        {errors?.name && (
          <p id={nameErrorId} className="text-xs text-destructive mt-1">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        <HabitTypeToggle value={habitType} onChange={setHabitType} />

        <div className="h-1" />

        <HabitAppearanceField
          icon={icon}
          onIconChange={setIcon}
          color={color}
          onColorChange={setColor}
        />

        <div className="h-1" />

        <HabitFrequencyField
          count={frequencyCount}
          period={frequencyPeriod}
          frequencyDays={frequencyDays}
          onCountChange={setFrequencyCount}
          onPeriodChange={setFrequencyPeriod}
          onFrequencyDaysChange={setFrequencyDays}
        />

        {habitType === "measurable" && (
          <>
            <div className="h-1" />
            <HabitTargetField
              targetValue={targetValue}
              unit={unit}
              targetType={targetType}
              onTargetValueChange={setTargetValue}
              onUnitChange={setUnit}
              onTargetTypeChange={setTargetType}
            />
          </>
        )}

        <div className="h-1" />

        <div className="mx-2">
          <HabitDisclosureRow
            icon={
              <SlidersHorizontal
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={2.25}
              />
            }
            label="More options"
            summary={moreSummary}
            open={moreOpen}
            onOpenChange={setMoreOpen}
          />

          <CollapsibleReveal open={moreOpen}>
            <div className="-mx-2">
              <HabitQuestionField
                question={question}
                onQuestionChange={setQuestion}
                habitType={habitType}
              />

              <div className="h-1" />

              <HabitReminderField
                reminderTime={reminderTime}
                onReminderTimeChange={setReminderTime}
                reminderDays={reminderDays}
                onReminderDaysChange={setReminderDays}
              />

              <div className="h-1" />

              <div className="mx-2">
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast">
                  <IconCell className="pt-[5px]">
                    <AlignLeft
                      className="h-4 w-4 text-muted-foreground"
                      strokeWidth={2.25}
                    />
                  </IconCell>
                  <textarea
                    id={descriptionId}
                    placeholder="Add details (optional)"
                    aria-label="Habit details"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={1}
                    className="flex-1 bg-transparent border-0 outline-none resize-none text-[15px] text-foreground placeholder:text-muted-foreground/70 leading-relaxed p-0 min-h-6 field-sizing-content max-h-32"
                  />
                </div>
              </div>
            </div>
          </CollapsibleReveal>
        </div>

        <div className="h-1" />
      </div>

      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <TaskDatePicker
          date={startDate}
          setDate={setStartDate}
          isMobile={isMobile}
          open={datePickerOpen}
          onOpenChange={setDatePickerOpen}
          variant="icon"
          icon={CalendarIcon}
          title="Start Date"
          showTime={true}
          allowPastDates={true}
          side="top"
          align="start"
          sideOffset={15}
        />

        <div className="flex-1" />

        {mode === "edit" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg transition-seijaku-fast"
            onClick={() => {
              trigger("toggle");
              props.onArchive();
            }}
            disabled={isPending}
            aria-label="Archive habit"
          >
            <Archive strokeWidth={2.25} />
          </Button>
        )}

        {mode === "edit" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg shadow-sm shadow-destructive/10 transition-seijaku-fast"
            onClick={() => {
              trigger("thud");
              props.onDelete();
            }}
            disabled={isPending}
            aria-label="Delete habit"
          >
            <Trash2 strokeWidth={2.25} />
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          aria-label={
            mode === "create"
              ? isPending
                ? "Creating habit"
                : "Start habit"
              : isPending
                ? "Saving"
                : "Save changes"
          }
        >
          {mode === "create" ? (
            <Send className="h-5 w-5 stroke-[2.25px]" />
          ) : (
            <Save className="h-5 w-5 stroke-[2.25px]" />
          )}
        </Button>
      </div>
    </div>
  );
}
