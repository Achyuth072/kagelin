import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface DestructiveAlertBannerProps {
  message: React.ReactNode;
  actionLabel: string;
  actionIcon: LucideIcon;
  onAction: () => void;
}

export function DestructiveAlertBanner({
  message,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}: DestructiveAlertBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-destructive-surface-border bg-destructive-surface px-4 py-2.5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <TriangleAlert
          className="h-4 w-4 shrink-0 text-destructive"
          strokeWidth={2.25}
        />
        <p className="text-sm text-destructive truncate">{message}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 gap-1.5 border-destructive-surface-border bg-transparent text-destructive hover:bg-destructive-surface-hover"
        onClick={onAction}
      >
        <ActionIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
        {actionLabel}
      </Button>
    </div>
  );
}
