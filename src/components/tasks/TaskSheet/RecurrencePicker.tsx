"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import { formatRecurrenceRule } from "@/lib/utils/recurrence";
import { useHaptic } from "@/lib/hooks/useHaptic";

interface RecurrencePickerProps {
  value: RecurrenceRule | null;
  onChange: (value: RecurrenceRule | null) => void;
  variant?: "default" | "icon" | "chip";
  isMobile?: boolean;
}

const PRESET_RULES: { label: string; value: RecurrenceRule | null }[] = [
  { label: "Does not repeat", value: null },
  { label: "Daily", value: { freq: "DAILY", interval: 1 } },
  { label: "Weekly", value: { freq: "WEEKLY", interval: 1 } },
  { label: "Monthly", value: { freq: "MONTHLY", interval: 1 } },
  { label: "Yearly", value: { freq: "YEARLY", interval: 1 } },
];

// Helper to get the letter code for the badge
function getRecurrenceBadge(value: RecurrenceRule | null) {
  if (!value) return null;

  if (value.interval === 1) {
    switch (value.freq) {
      case "DAILY":
        return "D";
      case "WEEKLY":
        return "W";
      case "MONTHLY":
        return "M";
      case "YEARLY":
        return "Y";
    }
  }
  return "C"; // Custom
}

export default function RecurrencePicker({
  value,
  onChange,
  variant = "default",
  isMobile = false,
}: RecurrencePickerProps) {
  const [open, setOpen] = useState(false);
  const isIconVariant = variant === "icon";
  const hasRecurrence = !!value;
  const badgeLetter = hasRecurrence ? getRecurrenceBadge(value) : null;
  const currentMode = value?.mode ?? "flexible";
  const { trigger } = useHaptic();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors shrink-0 h-auto shadow-none",
              hasRecurrence
                ? "bg-secondary/70 border-border/80 font-semibold text-foreground"
                : "bg-secondary/40 hover:bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground",
            )}
            onClick={() => {
              trigger("toggle");
            }}
            title={!isMobile ? formatRecurrenceRule(value) : undefined}
          >
            <Repeat
              className={cn(
                "h-3.5 w-3.5",
                hasRecurrence ? "text-foreground" : "text-muted-foreground",
              )}
            />
            <span>Repeat: {value ? formatRecurrenceRule(value) : "None"}</span>
          </Button>
        ) : isIconVariant ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-9 p-0 transition-all group relative border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none",
              hasRecurrence
                ? "text-brand bg-brand/10 hover:bg-brand/20 hover:text-brand border-transparent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            onClick={() => {
              trigger("toggle");
            }}
            title={!isMobile ? formatRecurrenceRule(value) : undefined}
          >
            <Repeat className="h-4 w-4 transition-all" strokeWidth={2} />
            {hasRecurrence && badgeLetter && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-brand text-brand-foreground rounded-full flex items-center justify-center">
                {badgeLetter}
              </span>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal h-9 text-[13px]"
          >
            <Repeat className="mr-2 h-4 w-4" />
            {formatRecurrenceRule(value)}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-1 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-md outline-none"
        align="start"
        sideOffset={4}
        collisionPadding={16}
      >
        <div className="space-y-0.5">
          {PRESET_RULES.map((preset) => {
            const isSelected =
              preset.value === null
                ? value === null
                : value?.freq === preset.value.freq &&
                  value?.interval === preset.value.interval;

            return (
              <button
                key={preset.label}
                type="button"
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-1.5 text-xs sm:text-[13px] outline-none transition-seijaku-fast",
                  isSelected
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
                onClick={() => {
                  trigger("toggle");
                  // Maintain existing mode if switching between presets
                  onChange(
                    preset.value
                      ? { ...preset.value, mode: value?.mode || "flexible" }
                      : null,
                  );
                  if (!preset.value) setOpen(false);
                }}
              >
                <span>{preset.label}</span>
                {isSelected && (
                  <Check
                    className="h-3.5 w-3.5 text-brand shrink-0"
                    strokeWidth={2.25}
                  />
                )}
              </button>
            );
          })}

          {value && (
            <>
              <div className="-mx-1 my-1 h-px bg-border/40" />
              <div className="p-1 pt-0.5">
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </span>
                </div>
                <Tabs
                  value={currentMode}
                  onValueChange={(val) => {
                    if (val && val !== currentMode) {
                      trigger("toggle");
                      onChange({
                        ...value,
                        mode: val as "strict" | "flexible",
                      });
                    }
                  }}
                  className="w-full"
                >
                  <TabsList size="sm" className="grid grid-cols-2 w-full">
                    <TabsTrigger value="strict">Strict</TabsTrigger>
                    <TabsTrigger value="flexible">Flexible</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-1 leading-normal">
                  {currentMode === "strict"
                    ? "Repeats from original due date."
                    : "Repeats from completion date."}
                </p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
