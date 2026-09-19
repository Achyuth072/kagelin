"use client";

import { createElement, useState } from "react";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { CollapsibleReveal } from "@/components/tasks/shared/CollapsibleReveal";
import { getHabitIcon, HabitIconPicker } from "./HabitIconPicker";
import { HabitDisclosureRow } from "./HabitDisclosureRow";

interface HabitAppearanceFieldProps {
  icon: string;
  onIconChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
}

export function HabitAppearanceField({
  icon,
  onIconChange,
  color,
  onColorChange,
}: HabitAppearanceFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-2">
      <HabitDisclosureRow
        icon={createElement(getHabitIcon(icon), {
          className: "h-4 w-4",
          strokeWidth: 2.25,
          style: { color },
        })}
        label="Icon & color"
        open={open}
        onOpenChange={setOpen}
      />

      <CollapsibleReveal open={open}>
        <div className="pl-11 pr-3 pb-2 space-y-3">
          <HabitIconPicker
            value={icon}
            onChange={onIconChange}
            variant="compact"
          />
          <ColorPicker
            value={color}
            onChange={onColorChange}
            variant="compact"
            ariaLabel="Habit color"
          />
        </div>
      </CollapsibleReveal>
    </div>
  );
}
