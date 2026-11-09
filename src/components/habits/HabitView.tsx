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
  ChevronDown,
} from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { CollapsibleReveal } from "../tasks/shared/CollapsibleReveal";
import { HabitDisclosureRow } from "./shared/HabitDisclosureRow";
import { HabitFrequencyField } from "./shared/HabitFrequencyField";
import { HabitIconPicker, getHabitIcon } from "./shared/HabitIconPicker";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { type TargetType } from "./shared/HabitTargetField";
import { HabitQuestionField } from "./shared/HabitQuestionField";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const frequencyLabel = (() => {
    if (frequencyPeriod === "day" && frequencyCount === 1) return "Daily";
    if (frequencyPeriod === "week") return `${frequencyCount}x / week`;
    if (frequencyPeriod === "month") return `${frequencyCount}x / month`;
    if (frequencyDays) return `${frequencyCount}x / ${frequencyDays}d`;
    return `${frequencyCount}x`;
  })();

  const moreSummary = [
    question.trim() && "Question",
    reminderTime && "Reminder",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col flex-1 overflow-hidden w-full max-w-full">
      {/* Title Input with Header-Integrated Icon Avatar Button */}
      <div className="px-4 pt-4.5 pb-2.5 sm:pt-5 sm:pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            data-testid="habit-header-badge"
            className="text-[10px] sm:text-xs font-mono uppercase text-brand tracking-wider font-semibold"
          >
            {habitIdBadge}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            · tap icon to customize
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Interactive Icon Avatar Button in Header */}
          <button
            type="button"
            onClick={() => {
              trigger("toggle");
              setAppearanceOpen((prev) => !prev);
            }}
            title="Customize habit icon and color"
            aria-label="Customize habit icon and color"
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95 border shadow-xs cursor-pointer",
              appearanceOpen
                ? "ring-2 ring-brand border-brand"
                : "border-border/60 hover:bg-secondary/40",
            )}
            style={{
              backgroundColor: `${color}15`,
            }}
          >
            {createElement(getHabitIcon(icon), {
              className: "h-5 w-5",
              strokeWidth: 2.25,
              style: { color },
            })}
          </button>

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
        </div>

        {errors?.name && (
          <p id={nameErrorId} className="text-xs text-destructive mt-1">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Inline Appearance Accordion (directly underneath the header) */}
      <CollapsibleReveal open={appearanceOpen}>
        <div className="px-4 pb-3 pt-1 border-b border-border/30 space-y-3">
          <HabitIconPicker value={icon} onChange={setIcon} variant="compact" />
          <ColorPicker
            value={color}
            onChange={setColor}
            variant="compact"
            ariaLabel="Habit color"
          />
        </div>
      </CollapsibleReveal>

      {/* Minimalist Property Strip — Ultra clean: Type + Frequency */}
      <div className="px-4 py-2 flex items-center gap-3 shrink-0">
        <div className="w-5 shrink-0 flex items-center justify-center text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <div
          data-testid="property-strip"
          className="py-1 px-0.5 flex items-center gap-2 flex-wrap min-w-0 flex-1"
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

          {/* Frequency Chip */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              trigger("toggle");
              setFrequencyOpen((prev) => !prev);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-md border transition-colors shrink-0 h-7 sm:h-8 shadow-none",
              frequencyOpen
                ? "bg-secondary border-border/80 text-foreground font-semibold"
                : "bg-secondary/40 hover:bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            <Repeat
              className="h-3.5 w-3.5 text-muted-foreground"
              strokeWidth={2.25}
            />
            <span>{frequencyLabel}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                frequencyOpen && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2.5 space-y-2">
        {/* Row 1: Target row when Measurable */}
        <CollapsibleReveal open={habitType === "measurable"}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast">
            <IconCell className="items-center pt-0 text-muted-foreground">
              <Target className="h-4 w-4" strokeWidth={2.25} />
            </IconCell>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                Target:
              </span>
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
                className="h-8 w-16 text-center text-xs sm:text-[13px] font-medium rounded-lg border border-border/40 bg-secondary/15 px-1.5 outline-none placeholder:text-muted-foreground/60 text-foreground focus:ring-1 focus:ring-brand"
              />
              <input
                type="text"
                placeholder="unit"
                aria-label="Target unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-8 px-2.5 text-xs sm:text-[13px] rounded-lg border border-border/40 bg-secondary/15 w-28 outline-none placeholder:text-muted-foreground/60 text-foreground focus:ring-1 focus:ring-brand"
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
                <TabsList size="sm" className="h-8 p-0.5">
                  <TabsTrigger
                    value="at_least"
                    aria-label="At least"
                    className="h-7 px-2 text-xs flex items-center gap-1"
                  >
                    <span>≥</span>
                    <span className="hidden sm:inline text-[11px]">
                      At least
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="at_most"
                    aria-label="At most"
                    className="h-7 px-2 text-xs flex items-center gap-1"
                  >
                    <span>≤</span>
                    <span className="hidden sm:inline text-[11px]">
                      At most
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CollapsibleReveal>

        {/* Inline Frequency Expansion */}
        <CollapsibleReveal open={frequencyOpen}>
          <div className="space-y-2 pt-1.5 pb-2">
            <HabitFrequencyField
              count={frequencyCount}
              period={frequencyPeriod}
              frequencyDays={frequencyDays}
              onCountChange={setFrequencyCount}
              onPeriodChange={setFrequencyPeriod}
              onFrequencyDaysChange={setFrequencyDays}
            />
          </div>
        </CollapsibleReveal>

        {/* More options Disclosure */}
        <div>
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
            <div className="space-y-1.5 pt-1.5 pb-1">
              <HabitQuestionField
                question={question}
                onQuestionChange={setQuestion}
                habitType={habitType}
              />
              <HabitReminderField
                reminderTime={reminderTime}
                onReminderTimeChange={setReminderTime}
                reminderDays={reminderDays}
                onReminderDaysChange={setReminderDays}
              />
            </div>
          </CollapsibleReveal>
        </div>

        {/* Notes Textarea */}
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors">
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
            className="flex-1 bg-transparent border-0 outline-none resize-none text-xs sm:text-[14px] text-foreground placeholder:text-muted-foreground/60 leading-relaxed p-0 min-h-6 field-sizing-content max-h-32"
          />
        </div>
      </div>

      {/* Anchored Footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 p-0 rounded-lg transition-colors"
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
              className="h-9 w-9 p-0 rounded-lg shadow-sm shadow-destructive/10 transition-colors"
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
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-colors flex items-center justify-center disabled:opacity-50"
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
