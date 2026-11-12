import type { ReactNode } from "react";

interface InsightSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function InsightSection({
  title,
  description,
  action,
  children,
}: InsightSectionProps) {
  return (
    <div className="border-t border-border/80 pt-4 space-y-3">
      {action || description ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="type-ui uppercase text-xs text-muted-foreground font-medium tracking-wider">
              {title}
            </p>
            {description && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 normal-case font-normal leading-normal">
                {description}
              </p>
            )}
          </div>
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
