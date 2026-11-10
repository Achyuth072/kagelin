"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface CollapsibleRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
  unmountOnExit?: boolean;
}

export function CollapsibleReveal({
  open,
  className,
  innerClassName,
  children,
  unmountOnExit = true,
  ...rest
}: CollapsibleRevealProps) {
  const [isRendered, setIsRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
    } else if (unmountOnExit) {
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, unmountOnExit]);

  const shouldRenderChildren = open || isRendered;

  return (
    <div
      aria-hidden={!open}
      inert={!open ? true : undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-seijaku",
        open
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0 pointer-events-none",
        className,
      )}
      {...rest}
    >
      <div className={cn("overflow-hidden", innerClassName)}>
        {shouldRenderChildren ? children : null}
      </div>
    </div>
  );
}
