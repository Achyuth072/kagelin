"use client";

import { CheckCircle2, Gauge } from "lucide-react";
import { IconCell } from "@/components/ui/IconCell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { HabitType } from "@/lib/types/habit";

interface HabitTypeToggleProps {
  value: HabitType;
  onChange: (value: HabitType) => void;
}

const OPTIONS: { value: HabitType; label: string }[] = [
  { value: "boolean", label: "Yes or No" },
  { value: "measurable", label: "Measurable" },
];

export function HabitTypeToggle({ value, onChange }: HabitTypeToggleProps) {
  const { trigger } = useHaptic();
  const Icon = value === "measurable" ? Gauge : CheckCircle2;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast mx-2">
      <IconCell className="items-center pt-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <Tabs
        value={value}
        onValueChange={(val) => {
          if (val && val !== value) {
            trigger("toggle");
            onChange(val as HabitType);
          }
        }}
        className="shrink-0"
      >
        <TabsList size="sm">
          {OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
