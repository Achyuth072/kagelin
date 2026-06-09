"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_HISTORY = 50;

interface LocationHistoryState {
  locations: string[];
  addLocation: (location: string) => void;
}

export const useLocationHistoryStore = create<LocationHistoryState>()(
  persist(
    (set) => ({
      locations: [],
      addLocation: (location: string) => {
        const trimmed = location.trim();
        if (!trimmed) return;
        set((state) => {
          const existing = state.locations.find(
            (l) => l.toLowerCase() === trimmed.toLowerCase(),
          );
          const canonical = existing ?? trimmed;
          const deduped = [
            canonical,
            ...state.locations.filter(
              (l) => l.toLowerCase() !== trimmed.toLowerCase(),
            ),
          ].slice(0, MAX_HISTORY);
          return { locations: deduped };
        });
      },
    }),
    {
      name: "kanso-location-history",
    },
  ),
);
