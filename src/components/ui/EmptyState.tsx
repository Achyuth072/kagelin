import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  shortcut?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
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
      <Icon className="h-6 w-6 text-muted-foreground/60" strokeWidth={2.25} />
      <div className="space-y-2">
        {title && <h2 className="type-h2">{title}</h2>}
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {description}
        </p>
      </div>
      {action && (
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={action.onClick}
            className="h-10 px-6 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm shadow-brand/10 transition-seijaku gap-2"
          >
            {ActionIcon && (
              <ActionIcon className="h-4 w-4" strokeWidth={2.25} />
            )}
            <span>{action.label}</span>
          </Button>
          {action.shortcut && (
            <p className="hidden md:pointer-fine:block text-sm text-muted-foreground">
              or press{" "}
              <kbd className="font-mono font-medium text-foreground">
                {action.shortcut}
              </kbd>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
