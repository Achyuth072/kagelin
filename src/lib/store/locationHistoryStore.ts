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
          const lower = trimmed.toLowerCase();
          let canonical = trimmed;
          const rest: string[] = [];
          for (const l of state.locations) {
            if (l.toLowerCase() === lower) {
              canonical = l;
            } else {
              rest.push(l);
            }
          }
          return { locations: [canonical, ...rest].slice(0, MAX_HISTORY) };
        });
      },
    }),
    {
      name: "kanso-location-history",
    },
  ),
);
