"use client";

import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";

interface HabitQuantityPopoverProps {
  stored: number | null;
  unit?: string | null;
  targetValue?: number | null;
  onLog: (value: number) => void;
  onClear: () => void;
  children: ReactNode;
}

export function HabitQuantityPopover({
  stored,
  unit,
  targetValue,
  onLog,
  onClear,
  children,
}: HabitQuantityPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { trigger } = useHaptic();
  const hasEntry = stored !== null;
  const loggedValue =
    stored !== null && stored !== ENTRY_VALUE_SKIPPED ? stored : null;

  return (
    // Modal so an outside tap only dismisses, never activating what's underneath.
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(loggedValue != null ? String(loggedValue) : "");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="flex w-52 flex-col gap-2 p-3"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex items-center gap-2">
          {targetValue != null && (
            <button
              type="button"
              onClick={() => {
                onLog(targetValue);
                trigger("success");
                setOpen(false);
              }}
              className="h-7 px-2 rounded-md border border-border/60 text-[12px] font-medium tabular-nums text-foreground transition-seijaku-fast hover:bg-secondary"
            >
              {targetValue}
              {unit ? ` ${unit}` : ""}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onLog(ENTRY_VALUE_SKIPPED);
              trigger("success");
              setOpen(false);
            }}
            className="ml-auto h-7 px-2 rounded-md text-[12px] font-medium text-muted-foreground transition-seijaku-fast hover:bg-secondary hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
