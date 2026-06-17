"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type SheetTab = "edit" | "insights";

interface SheetTabToggleProps {
  value: SheetTab;
  onValueChange: (value: SheetTab) => void;
}

export function SheetTabToggle({ value, onValueChange }: SheetTabToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as SheetTab);
      }}
      className="w-full"
    >
      <ToggleGroupItem value="edit" className="flex-1">
        Edit
      </ToggleGroupItem>
      <ToggleGroupItem value="insights" className="flex-1">
        Insights
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
