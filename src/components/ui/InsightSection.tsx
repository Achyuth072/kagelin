import type { ReactNode } from "react";

interface InsightSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function InsightSection({
  title,
  action,
  children,
}: InsightSectionProps) {
  return (
    <div className="border-t border-border/80 pt-4 space-y-3">
      {action ? (
        <div className="flex items-center justify-between">
          <p className="type-ui uppercase text-xs text-muted-foreground font-medium tracking-wider">
            {title}
          </p>
          {action}
        </div>
      ) : (
        <p className="type-ui uppercase text-xs text-muted-foreground font-medium tracking-wider">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
