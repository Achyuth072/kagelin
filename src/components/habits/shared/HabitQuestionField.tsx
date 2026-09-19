"use client";

import { HelpCircle } from "lucide-react";
import { IconCell } from "@/components/ui/IconCell";
import type { HabitType } from "@/lib/types/habit";

interface HabitQuestionFieldProps {
  question: string;
  onQuestionChange: (value: string) => void;
  habitType: HabitType;
}

const PLACEHOLDER: Record<HabitType, string> = {
  boolean: "Did you wake up early today?",
  measurable: "How many pages did you read?",
};

export function HabitQuestionField({
  question,
  onQuestionChange,
  habitType,
}: HabitQuestionFieldProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast mx-2">
      <IconCell className="items-center pt-0">
        <HelpCircle
          className="h-4 w-4 text-muted-foreground"
          strokeWidth={2.25}
        />
      </IconCell>
      <input
        type="text"
        placeholder={PLACEHOLDER[habitType]}
        aria-label="Habit question"
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-foreground placeholder:text-muted-foreground/60 p-0"
      />
    </div>
  );
}
