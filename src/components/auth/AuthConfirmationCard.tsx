"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthConfirmationCard({
  motionKey,
  title,
  description,
  descriptionMaxWidthClassName = "max-w-[260px]",
  actionLabel,
  onAction,
}: {
  motionKey: string;
  title: string;
  description: React.ReactNode;
  descriptionMaxWidthClassName?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col items-center justify-center text-center space-y-4"
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 className="h-6 w-6 text-primary" strokeWidth={2.25} />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p
          className={cn(
            "text-sm text-muted-foreground mx-auto",
            descriptionMaxWidthClassName,
          )}
        >
          {description}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAction}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {actionLabel}
      </Button>
    </motion.div>
  );
}
