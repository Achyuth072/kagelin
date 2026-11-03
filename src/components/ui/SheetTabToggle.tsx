"use client";

import { Pencil, BarChart3 } from "lucide-react";
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
        <TabsTrigger value="edit" aria-label="Edit">
          <Pencil strokeWidth={2.25} aria-hidden="true" />
          <span className="hidden sm:inline">Edit</span>
        </TabsTrigger>
        <TabsTrigger value="insights" aria-label="Insights">
          <BarChart3 strokeWidth={2.25} aria-hidden="true" />
          <span className="hidden sm:inline">Insights</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
