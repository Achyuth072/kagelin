"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Sparkles } from "lucide-react";
import {
  useChangelogEntries,
  isNewerThan,
  SECTION_ORDER,
  type ChangelogEntry,
} from "@/lib/changelog-cache";

interface ChangelogPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EntryView({ entry }: { entry: ChangelogEntry }) {
  const visibleSections = SECTION_ORDER.filter(
    (k) => (entry.sections[k]?.length ?? 0) > 0,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">
          v{entry.version}
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground">
          {entry.date}
        </span>
      </div>
      {visibleSections.length > 0 ? (
        <div className="space-y-3">
          {visibleSections.map((key) => (
            <div key={key}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
                {key}
              </p>
              <ul className="space-y-1">
                {entry.sections[key]!.map((item, i) => (
                  <li
                    key={i}
                    className="text-[13px] leading-relaxed text-foreground/90 font-medium pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-0.5 before:w-0.5 before:rounded-full before:bg-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-foreground/90 font-medium italic">
          No user-facing changes in this build.
        </p>
      )}
    </div>
  );
}

export function ChangelogPopup({ open, onOpenChange }: ChangelogPopupProps) {
  const { entries: displayEntries, loading } = useChangelogEntries(open);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-130 border-border/80 shadow-none p-0">
        <ResponsiveDialogHeader className="p-6 pb-3 border-b border-border/80">
          <ResponsiveDialogTitle className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            What&apos;s New
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-[11px] font-semibold tracking-[0.01em] text-foreground pt-1">
            {displayEntries.length > 0
              ? `Kanso v${displayEntries[0].version}`
              : "Recent changes"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[55vh] overflow-y-auto scrollbar-hide p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/70" />
            </div>
          )}
          {!loading &&
            displayEntries.map((entry) => (
              <EntryView key={entry.version} entry={entry} />
            ))}
          {!loading && displayEntries.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-8 font-medium">
              No changelog entries found.
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export { isNewerThan };
