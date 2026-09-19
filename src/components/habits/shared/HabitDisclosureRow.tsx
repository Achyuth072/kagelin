"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";

interface HabitDisclosureRowProps {
  icon: React.ReactNode;
  label: string;
  summary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HabitDisclosureRow({
  icon,
  label,
  summary,
  open,
  onOpenChange,
}: HabitDisclosureRowProps) {
  const { trigger } = useHaptic();

  return (
    <button
      type="button"
      onClick={() => {
        trigger("toggle");
        onOpenChange(!open);
      }}
      aria-expanded={open}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-seijaku-fast text-left hover:bg-muted/40"
    >
      <IconCell className="items-center pt-0">{icon}</IconCell>
      <span className="text-sm text-foreground">{label}</span>
      {summary && !open && (
        <span className="text-[13px] text-muted-foreground truncate min-w-0 flex-1">
          {summary}
        </span>
      )}
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-seijaku-fast ml-auto shrink-0",
          open && "rotate-180",
        )}
        strokeWidth={2.25}
      />
    </button>
  );
}
