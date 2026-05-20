"use client";

import { useEffect, useState } from "react";

export interface ChangelogCommit {
  hash: string;
  heading: string;
  body: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  commits: ChangelogCommit[];
}

let cache: ChangelogEntry[] | null = null;
let fetchPromise: Promise<ChangelogEntry[]> | null = null;

export function invalidateChangelogCache(): void {
  cache = null;
  fetchPromise = null;
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

export function parseVersion(v: string): number[] {
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
  appVersion: string,
): ChangelogEntry[] {
  const isPreview = appVersion.includes("preview");

  if (isPreview) {
    const parts = parseVersion(appVersion);
    const prefix = `${parts[0] ?? 0}.${parts[1] ?? 0}.`;
    return entries.filter(
      (e) =>
        e.version !== "unreleased" &&
        e.version.startsWith(prefix) &&
        e.version.includes("preview"),
    );
  }

  return entries
    .filter((e) => e.version !== "unreleased" && !e.version.includes("preview"))
    .slice(0, 3);
}

export function useChangelogEntries(
  open: boolean,
  appVersion: string,
  forceVersion?: string,
): { entries: ChangelogEntry[]; loading: boolean } {
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

  const targetVersion = forceVersion ?? appVersion;
  const filtered = filterForDisplay(entries, targetVersion);

  return { entries: filtered, loading: loading && cache === null };
}
