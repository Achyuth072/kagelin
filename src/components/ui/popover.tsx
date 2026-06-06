import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    disablePortal?: boolean;
    container?: HTMLElement | null;
  }
>(
  (
    {
      className,
      align = "center",
      sideOffset = 4,
      collisionPadding = 8,
      disablePortal = false,
      container,
      ...props
    },
    ref,
  ) => {
    const content = (
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // pointer-events-auto overrides the pointer-events:none that Vaul
          // sets on <body> when a drawer is open, keeping portaled popovers
          // interactive on mobile without needing disablePortal.
          "pointer-events-auto z-70 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
          className,
        )}
        {...props}
      />
    );
    if (disablePortal) return content;
    return (
      <PopoverPrimitive.Portal container={container ?? undefined}>
        {content}
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
