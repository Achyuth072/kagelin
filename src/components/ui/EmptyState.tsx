import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 py-32 text-center",
        className,
      )}
    >
      <div className="w-20 h-20 rounded-2xl bg-secondary/30 flex items-center justify-center mb-2">
        <Icon
          className="h-10 w-10 text-muted-foreground/60"
          strokeWidth={2.25}
        />
      </div>
      <div className="space-y-2">
        <h2 className="type-h2">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {description}
        </p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          className="h-10 px-6 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm shadow-brand/10 transition-seijaku gap-2"
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" strokeWidth={2.25} />}
          <span>{action.label}</span>
        </Button>
      )}
    </div>
  );
}
