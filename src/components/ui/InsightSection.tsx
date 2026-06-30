import type { ReactNode } from "react";

interface InsightSectionProps {
  title: string;
  children: ReactNode;
}

export function InsightSection({ title, children }: InsightSectionProps) {
  return (
    <div className="border-t border-border/80 pt-4 space-y-3">
      <p className="type-ui uppercase text-xs text-foreground/60 font-semibold tracking-wider">
        {title}
      </p>
      {children}
    </div>
  );
}
