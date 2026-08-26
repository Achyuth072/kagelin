"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CollapsibleRevealProps {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}

export function CollapsibleReveal({
  open,
  className,
  children,
}: CollapsibleRevealProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.1, 1, 0.2, 1] }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
