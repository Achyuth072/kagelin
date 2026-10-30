"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SheetTab = "edit" | "insights";

interface SheetTabToggleProps {
  value: SheetTab;
  onValueChange: (value: SheetTab) => void;
}

export function SheetTabToggle({ value, onValueChange }: SheetTabToggleProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as SheetTab)}
    >
      <TabsList size="lg">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
