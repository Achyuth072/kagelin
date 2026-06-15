"use client";

import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface AddHabitFabProps {
  onClick: () => void;
}

export default function AddHabitFab({ onClick }: AddHabitFabProps) {
  const { trigger, isPhone } = useHaptic();

  return (
    <motion.button
      onTapStart={() => trigger("thud")}
      whileTap={isPhone ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        buttonVariants({ size: "lg" }),
        "fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-6 h-14 w-14 rounded-xl shadow-lg md:hidden cursor-pointer z-40",
        "[@media(max-height:400px)]:right-3 [@media(max-height:400px)]:h-10 [@media(max-height:400px)]:w-10",
      )}
    >
      <Plus className="h-6 w-6 [@media(max-height:400px)]:h-4 [@media(max-height:400px)]:w-4" />
    </motion.button>
  );
}
