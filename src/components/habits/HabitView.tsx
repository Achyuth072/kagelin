"use client";

import { createElement, useRef, useState } from "react";
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
  AlignLeft,
  SlidersHorizontal,
  Target,
  Repeat,
} from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { CollapsibleReveal } from "../tasks/shared/CollapsibleReveal";
import { HabitDisclosureRow } from "./shared/HabitDisclosureRow";
import { HabitFrequencyField } from "./shared/HabitFrequencyField";
import { HabitIconPicker, getHabitIcon } from "./shared/HabitIconPicker";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { type TargetType } from "./shared/HabitTargetField";
import { HabitQuestionField } from "./shared/HabitQuestionField";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FrequencyPeriod, HabitType } from "@/lib/types/habit";
import { HabitReminderField } from "./shared/HabitReminderField";
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
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateHabitInput>;
  habitId?: string;
  autoFocusTitle?: boolean;
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
    hasContent,
    isPending,
    onSubmit,
    onKeyDown,
    errors,
    habitId,
    autoFocusTitle,
  } = props;

  const { trigger } = useHaptic();
  const scrollRef = useHorizontalScroll();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
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

  const habitIdBadge =
    mode === "create"
      ? "HABIT-NEW"
      : habitId
        ? (() => {
            const raw = habitId
              .replace(/^habit-/i, "")
              .replace(/-/g, "")
              .toUpperCase();
            return `HABIT-${raw.slice(0, 4)}`;
          })()
        : "HABIT-101";

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden w-full max-w-full">
      {/* Title Input — unboxed native input, border-b (FORM_PATTERNS.md lines 35-39) */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <span
          data-testid="habit-header-badge"
          className="text-[10px] sm:text-xs font-mono uppercase text-brand tracking-wider font-semibold block mb-0.5"
        >
          {habitIdBadge}
        </span>
        <input
          type="text"
          ref={titleInputRef}
          id={nameId}
          placeholder="Habit name"
          aria-label="Habit name"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[\r\n]+/g, " "))}
          onKeyDown={handleTitleKeyDown}
          autoFocus={
            autoFocusTitle !== undefined ? autoFocusTitle : isFinePointer
          }
          className={cn(
            "w-full text-xl font-semibold tracking-tight bg-transparent border-b border-border/40 pb-2 pt-0.5 outline-none placeholder:text-muted-foreground/50 text-foreground",
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

      {/* Property Strip — Habit Type, Appearance, Frequency, and Target in a Single Horizontal Line */}
      <div className="px-4 py-1.5 flex items-center gap-2.5 shrink-0">
        <div className="w-5 shrink-0 flex items-center justify-center text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <div
          ref={scrollRef}
          data-testid="property-strip"
          className="py-1 px-0.5 flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0 flex-1 pr-2"
        >
          {/* Habit Type Segmented Tabs */}
          <Tabs
            value={habitType}
            onValueChange={(val) => {
              if (val && val !== habitType) {
                trigger("toggle");
                setHabitType(val as HabitType);
              }
            }}
            className="shrink-0"
          >
            <TabsList size="sm" className="h-7 sm:h-8 p-0.5">
              <TabsTrigger
                value="boolean"
                className="h-6 sm:h-7 px-2.5 text-xs sm:text-[13px]"
              >
                Yes or No
              </TabsTrigger>
              <TabsTrigger
                value="measurable"
                className="h-6 sm:h-7 px-2.5 text-xs sm:text-[13px]"
              >
                Measurable
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Appearance Chip (Icon & Color Popover) */}
          <Popover open={appearanceOpen} onOpenChange={setAppearanceOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => trigger("toggle")}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-md border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-muted-foreground hover:text-foreground shrink-0 h-7 sm:h-8 shadow-none"
              >
                {createElement(getHabitIcon(icon), {
                  className: "h-3.5 w-3.5",
                  strokeWidth: 2.25,
                  style: { color },
                })}
                <span>Icon & color</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-3 space-y-3 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-md outline-none"
              align="start"
              sideOffset={4}
              collisionPadding={16}
            >
              <HabitIconPicker
                value={icon}
                onChange={setIcon}
                variant="compact"
              />
              <ColorPicker
                value={color}
                onChange={setColor}
                variant="compact"
                ariaLabel="Habit color"
              />
            </PopoverContent>
          </Popover>

          {/* Frequency Chip (Popover) */}
          <Popover open={frequencyOpen} onOpenChange={setFrequencyOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => trigger("toggle")}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-md border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-muted-foreground hover:text-foreground shrink-0 h-7 sm:h-8 shadow-none"
              >
                <Repeat
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={2.25}
                />
                <span>
                  {(() => {
                    if (frequencyPeriod === "day" && frequencyCount === 1)
                      return "Daily";
                    if (frequencyPeriod === "week")
                      return `${frequencyCount}x / week`;
                    if (frequencyPeriod === "month")
                      return `${frequencyCount}x / month`;
                    if (frequencyDays)
                      return `${frequencyCount}x / ${frequencyDays}d`;
                    return `${frequencyCount}x`;
                  })()}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-3 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-md outline-none"
              align="start"
              sideOffset={4}
              collisionPadding={16}
            >
              <HabitFrequencyField
                count={frequencyCount}
                period={frequencyPeriod}
                frequencyDays={frequencyDays}
                onCountChange={setFrequencyCount}
                onPeriodChange={setFrequencyPeriod}
                onFrequencyDaysChange={setFrequencyDays}
              />
            </PopoverContent>
          </Popover>

          {/* Target Inputs for Measurable Habit */}
          {habitType === "measurable" && (
            <div className="flex items-center gap-1.5 bg-secondary/40 rounded-md px-2 py-0.5 border border-border/50 shrink-0 h-7 sm:h-8">
              <Target
                className="h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={2.25}
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                aria-label="Target value"
                value={targetValue ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setTargetValue(raw === "" ? undefined : Number(raw));
                }}
                className="h-5 sm:h-6 w-12 sm:w-14 text-center text-xs sm:text-[13px] font-medium rounded border border-border/40 bg-background/50 p-0 outline-none placeholder:text-muted-foreground/60 text-foreground"
              />
              <input
                type="text"
                placeholder="unit"
                aria-label="Target unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-5 sm:h-6 px-1 text-xs sm:text-[13px] rounded border border-border/40 bg-background/50 w-14 sm:w-16 outline-none placeholder:text-muted-foreground/60 text-foreground"
              />
              <Tabs
                value={targetType}
                onValueChange={(val) => {
                  if (val) {
                    trigger("toggle");
                    setTargetType(val as TargetType);
                  }
                }}
                className="shrink-0"
              >
                <TabsList
                  size="sm"
                  className="h-5 sm:h-6 p-0 bg-transparent border-0"
                >
                  <TabsTrigger
                    value="at_least"
                    aria-label="At least"
                    className="h-5 sm:h-6 w-5 sm:w-6 px-0 text-[10px] sm:text-xs"
                  >
                    ≥
                  </TabsTrigger>
                  <TabsTrigger
                    value="at_most"
                    aria-label="At most"
                    className="h-5 sm:h-6 w-5 sm:w-6 px-0 text-[10px] sm:text-xs"
                  >
                    ≤
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Main Body: Question, Reminder, Notes / More options */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2 space-y-1">
        <div className="mx-0">
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
            <div className="space-y-1 pt-1">
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
          </CollapsibleReveal>
        </div>
      </div>

      {/* Anchored Footer — Left slot aligned with TaskView, Action CTAs on Right */}
      <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <div className="flex items-center gap-2">
          {/* Left slot placeholder */}
        </div>

        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 p-0 rounded-lg transition-seijaku-fast"
              onClick={() => {
                trigger("toggle");
                props.onArchive();
              }}
              disabled={isPending}
              aria-label="Archive habit"
              title="Archive habit"
            >
              <Archive className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          )}

          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-9 w-9 p-0 rounded-lg shadow-sm shadow-destructive/10 transition-seijaku-fast"
              onClick={() => {
                trigger("thud");
                props.onDelete();
              }}
              disabled={isPending}
              aria-label="Delete habit"
              title="Delete habit"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center disabled:opacity-50"
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
            title={
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
    </div>
  );
}
