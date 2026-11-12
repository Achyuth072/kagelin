import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoaderOverlayProps {
  message?: string;
  className?: string;
}

export function LoaderOverlay({
  message = "Loading...",
  className,
}: LoaderOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 bg-background/80 z-[var(--z-alert)]",
        "flex flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <Loader2
        className="h-8 w-8 animate-spin text-primary"
        strokeWidth={2.25}
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
