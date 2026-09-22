"use client";

import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useHaptic } from "@/lib/hooks/useHaptic";

/** Shared between HabitCard and HabitStripCell trigger labels. */
export function quantityLoggedPhrase(
  loggedValue: number | null,
  unit?: string | null,
  skipped?: boolean,
): string {
  if (loggedValue != null) {
    return `${loggedValue}${unit ? ` ${unit}` : ""} logged`;
  }
  return skipped ? "skipped" : "not logged";
}

interface HabitQuantityPopoverProps {
  loggedValue: number | null;
  hasEntry: boolean;
  unit?: string | null;
  onLog: (value: number) => void;
  onClear: () => void;
  children: ReactNode;
}

export function HabitQuantityPopover({
  loggedValue,
  hasEntry,
  unit,
  onLog,
  onClear,
  children,
}: HabitQuantityPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { trigger } = useHaptic();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(loggedValue != null ? String(loggedValue) : "");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-3" onClick={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (trimmed === "") {
              if (!hasEntry) return;
              onClear();
            } else {
              const parsed = Number(trimmed);
              if (Number.isNaN(parsed) || parsed < 0) return;
              onLog(parsed);
            }
            trigger("success");
            setOpen(false);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            autoFocus
            aria-label="Log amount"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-16 text-center text-[13px] font-medium rounded-lg border border-border/40 bg-secondary/10 p-0 outline-none"
          />
          {unit && (
            <span className="text-[13px] text-muted-foreground">{unit}</span>
          )}
          <button
            type="submit"
            className="ml-auto h-8 px-2.5 rounded-lg bg-brand text-brand-foreground text-[13px] font-medium transition-seijaku-fast hover:bg-brand/90"
          >
            Log
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
