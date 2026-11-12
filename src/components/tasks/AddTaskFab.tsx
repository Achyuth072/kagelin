"use client";

import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import * as m from "motion/react-m";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface AddTaskFabProps {
  onClick?: () => void;
  onPointerDown?: () => void;
}

export default function AddTaskFab({
  onClick,
  onPointerDown,
}: AddTaskFabProps) {
  const { trigger, isPhone } = useHaptic();

  return (
    <m.button
      data-testid="fab"
      onTapStart={() => trigger("thud")}
      whileTap={isPhone ? { scale: 0.95 } : {}}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        buttonVariants({ size: "lg" }),
        "fixed bottom-[calc(var(--mobile-nav-height)+0.75rem)] right-6 h-12 w-12 rounded-xl shadow-sm md:hidden cursor-pointer z-[var(--z-floating)]",
        "[@media(max-height:400px)]:right-3 [@media(max-height:400px)]:h-10 [@media(max-height:400px)]:w-10",
      )}
    >
      <Plus
        className="h-5 w-5 [@media(max-height:400px)]:h-4 [@media(max-height:400px)]:w-4"
        strokeWidth={2.25}
      />
    </m.button>
  );
}
