import { cn } from "@/lib/utils";

/**
 * Fixed-width icon cell for icon-led form rows (FORM_PATTERNS Variant A). Keeps
 * the text columns aligned across every row regardless of the leading glyph.
 * Shared by the create/edit dialogs for tasks, habits, projects, events, and
 * focus settings so the row geometry can't drift between them.
 */
export function IconCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-5 shrink-0 flex items-start justify-center pt-[3px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
