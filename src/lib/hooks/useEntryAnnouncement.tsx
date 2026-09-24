import { useState } from "react";
import type { StoredEntry } from "@/lib/utils/habit-entry-cycle";

export function useEntryAnnouncement(stored: StoredEntry, stateText: string) {
  const [activatedAt, setActivatedAt] = useState<StoredEntry | undefined>();
  const liveRegion = (
    <span aria-live="polite" className="sr-only">
      {activatedAt !== undefined && stored !== activatedAt ? stateText : ""}
    </span>
  );
  return { liveRegion, onActivate: () => setActivatedAt(stored) };
}
