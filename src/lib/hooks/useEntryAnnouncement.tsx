import { useState } from "react";
import { ENTRY_VALUE_DONE, ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";
import type { StoredEntry } from "@/lib/utils/habit-entry-cycle";

export function useEntryAnnouncement(stored: StoredEntry, stateText: string) {
  const [activatedAt, setActivatedAt] = useState<StoredEntry | undefined>();

  let announcement = "";
  if (activatedAt !== undefined && stored !== activatedAt) {
    if (stored === ENTRY_VALUE_SKIPPED) {
      announcement = "Habit skipped as rest day, tap again to clear";
    } else if (stored !== null && stored >= ENTRY_VALUE_DONE) {
      announcement = "Habit completed";
    } else if (stored === null) {
      announcement = "Habit entry cleared";
    } else {
      announcement = stateText;
    }
  }

  const liveRegion = (
    <span role="status" aria-live="polite" className="sr-only">
      {announcement}
    </span>
  );
  return { liveRegion, onActivate: () => setActivatedAt(stored) };
}
