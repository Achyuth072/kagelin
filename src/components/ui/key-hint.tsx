import * as React from "react";
import { cn } from "@/lib/utils";

// Inline shortcut hint beside a label (menus, sidebar). Reference sheets
// render full keycaps instead — there the keys are the content.
export function KeyHint({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "ml-auto font-mono text-[11px] tracking-[0.02em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
