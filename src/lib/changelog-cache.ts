"use client";

import { useEffect, useState } from "react";

export type ChangelogSectionKey = "Added" | "Improved" | "Fixed";

export const SECTION_ORDER: ChangelogSectionKey[] = [
  "Added",
  "Improved",
  "Fixed",
];

export interface ChangelogEntry {
  version: string;
  date: string | null;
  channel: "preview" | "stable";
  sections: Partial<Record<ChangelogSectionKey, string[]>>;
}

export const RELEASE_CHANNEL: "preview" | "stable" =
  process.env.NEXT_PUBLIC_RELEASE_CHANNEL === "stable" ? "stable" : "preview";

let cache: ChangelogEntry[] | null = null;
let fetchPromise: Promise<ChangelogEntry[]> | null = null;

export interface ChangelogVersionInfo {
  version: string;
  channel: "preview" | "stable";
}

let versionCache: ChangelogVersionInfo | null = null;

export function invalidateChangelogCache(): void {
  cache = null;
  fetchPromise = null;
  versionCache = null;
}

export function fetchLatestVersion(): Promise<ChangelogVersionInfo | null> {
  if (versionCache) return Promise.resolve(versionCache);

  return fetch("/changelog-version.json")
    .then((r) => r.json())
    .then((data: ChangelogVersionInfo) => {
      versionCache = data;
      return data;
    })
    .catch(() => null);
}

export function prefetchChangelog(): Promise<ChangelogEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/changelog.json")
    .then((r) => r.json())
    .then((data: ChangelogEntry[]) => {
      cache = data;
      fetchPromise = null;
      return data;
    })
    .catch(() => {
      fetchPromise = null;
      return [] as ChangelogEntry[];
    });

  return fetchPromise;
}

function parseVersion(v: string): number[] {
  return v.split(/[.-]/).map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
}

export function isNewerThan(a: string, b: string): boolean {
  if (!b) return true;
  const ap = parseVersion(a);
  const bp = parseVersion(b);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if ((ap[i] ?? 0) !== (bp[i] ?? 0)) return (ap[i] ?? 0) > (bp[i] ?? 0);
  }
  return false;
}

export function filterForDisplay(
  entries: ChangelogEntry[],
  channel: "preview" | "stable" = RELEASE_CHANNEL,
): ChangelogEntry[] {
  const isStable = channel === "stable";
  const released = entries.filter((e) => e.version !== "Unreleased");
  const visible = isStable
    ? released.filter((e) => e.channel === "stable")
    : released;
  return visible.slice(0, isStable ? 3 : 15);
}

export function latestVisibleVersion(
  entries: ChangelogEntry[],
  channel: "preview" | "stable" = RELEASE_CHANNEL,
): string | null {
  const isStable = channel === "stable";
  for (const e of entries) {
    if (e.version === "Unreleased") continue;
    if (!isStable || e.channel === "stable") return e.version;
  }
  return null;
}

export function useChangelogEntries(open: boolean): {
  entries: ChangelogEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<ChangelogEntry[]>(() => cache ?? []);
  const [loading, setLoading] = useState(() => cache === null);

  useEffect(() => {
    if (cache === null) {
      prefetchChangelog().then((data) => {
        setEntries(data);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      prefetchChangelog().then((data) => {
        setEntries(data);
        setLoading(false);
      });
    }
  }, [open]);

  const filtered = filterForDisplay(entries);
  return { entries: filtered, loading: loading && cache === null };
}
