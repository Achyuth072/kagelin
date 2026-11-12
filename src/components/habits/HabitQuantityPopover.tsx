"use client";

import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { NumberField } from "@/components/ui/number-field";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [draft, setDraft] = useState<number | null>(null);
  const { trigger } = useHaptic();
  const hasEntry = stored !== null;
  const loggedValue =
    stored !== null && stored !== ENTRY_VALUE_SKIPPED ? stored : null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setDraft(loggedValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft == null) {
      if (!hasEntry) return;
      onClear();
    } else {
      if (draft < 0) return;
      onLog(draft);
    }
    trigger("success");
    setOpen(false);
  };

  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <NumberField
          value={draft}
          onValueChange={(val) => setDraft(val)}
          min={0}
          step={1}
          showSteppers={false}
          autoFocus
          aria-label="Log amount"
          placeholder="0"
          className="w-20"
          inputClassName="w-20"
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
    </>
  );

  if (isMobile) {
    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
        <ResponsiveDialogContent className="p-4 flex flex-col gap-3">
          <ResponsiveDialogHeader className="p-0 sr-only">
            <ResponsiveDialogTitle>Log amount</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Log quantity for this habit
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div
            className="flex flex-col gap-3 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            {formContent}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    // Modal so an outside tap only dismisses, never activating what's underneath.
    <Popover modal open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="flex w-52 flex-col gap-2 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {formContent}
      </PopoverContent>
    </Popover>
  );
}
