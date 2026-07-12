import type { ComponentProps, KeyboardEvent } from "react";
import { useImperativeHandle, useRef } from "react";
import { Slot } from "@radix-ui/react-slot";

import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type KanbanBoardCardButtonProps = {
  tooltip?: string;
  asChild?: boolean;
};

/**
 * A button that can be used within a KanbanBoardCard.
 * It's a div under the hood because you shouldn't nest buttons within buttons,
 * and the card is a button.
 */
export function KanbanBoardCardButton({
  className,
  tooltip,
  asChild,
  ref: externalReference,
  ...props
}: ComponentProps<"div"> & KanbanBoardCardButtonProps) {
  const internalReference = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(externalReference, () => internalReference.current!);

  // Emulate button behavior: Enter/Space activate, without scrolling or bubbling.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      internalReference.current?.click();
    }
  };

  const Comp = asChild ? Slot : "div";

  const button = (
    <Comp
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "border-border size-5 border hover:cursor-default [&_svg]:size-3.5",
        className,
      )}
      onKeyDown={asChild ? undefined : handleKeyDown}
      role={asChild ? undefined : "button"}
      tabIndex={asChild ? undefined : 0}
      aria-label={tooltip}
      ref={internalReference}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>

      <TooltipContent align="center" side="bottom">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
