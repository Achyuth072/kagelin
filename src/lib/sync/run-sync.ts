import { createClient } from "@/lib/supabase/client";
import { syncExternalCalendar, pushPendingEvents } from "./orchestrator";
import { getAdapter, type SyncAdapterConfig } from "./adapter-interface";
import type { ExternalCalendar } from "@/lib/types/external-calendar";
import "./register-adapters";

const OAUTH_PROVIDERS = ["google", "outlook"];

export interface RunSyncSummary {
  configured: number;
  created: number;
  updated: number;
  archived: number;
  pushed: number;
  errors: string[];
}

/**
 * Human-readable summary line for a completed sync. Reports every kind of change
 * (not just created/pushed) and says "up to date" when a sync ran cleanly with
 * nothing to do — so "0 pulled, 0 pushed" never looks like a failure.
 */
export function formatSyncSummary(s: RunSyncSummary): string {
  const parts: string[] = [];
  if (s.created) parts.push(`${s.created} added`);
  if (s.updated) parts.push(`${s.updated} updated`);
  if (s.archived) parts.push(`${s.archived} removed`);
  if (s.pushed) parts.push(`${s.pushed} pushed`);
  return parts.length ? `Synced — ${parts.join(", ")}` : "Calendar is up to date";
}

/** Fetch one access token per OAuth provider in the set, deduplicated + parallel. */
async function mintTokens(providers: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  const oauth = [...new Set(providers.filter((p) => OAUTH_PROVIDERS.includes(p)))];
  await Promise.all(
    oauth.map(async (provider) => {
      const res = await fetch(`/api/calendar/token?provider=${provider}`);
      if (!res.ok) throw new Error(`${provider} needs reconnecting`);
      cache.set(provider, (await res.json()).access_token as string);
    }),
  );
  return cache;
}

/**
 * Full sync (pull + push) of every sync-enabled external calendar. OAuth
 * providers get a fresh access token; CalDAV falls through with no extra config.
 */
export async function runCalendarSync(): Promise<RunSyncSummary> {
  const supabase = createClient();
  const { data: calendars } = await supabase
    .from("external_calendars")
    .select("id, provider")
    .eq("sync_enabled", true);

  const summary: RunSyncSummary = {
    configured: calendars?.length ?? 0,
    created: 0,
    updated: 0,
    archived: 0,
    pushed: 0,
    errors: [],
  };
  if (!calendars?.length) return summary;

  const list = calendars as { id: string; provider: string }[];
  const tokenCache = await mintTokens(list.map((c) => c.provider));

  const results = await Promise.allSettled(
    list.map(async (cal) => {
      const config: Partial<SyncAdapterConfig> = {};
      if (OAUTH_PROVIDERS.includes(cal.provider)) {
        const token = tokenCache.get(cal.provider);
        if (!token) throw new Error(`${cal.provider} needs reconnecting`);
        config.accessToken = token;
      }
      return syncExternalCalendar(cal.id, config);
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      summary.created += r.value.created;
      summary.updated += r.value.updated;
      summary.archived += r.value.archived;
      summary.pushed += r.value.pushed;
      summary.errors.push(...r.value.errors);
    } else {
      summary.errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }

  return summary;
}

/**
 * Push-only flush of locally-queued changes (sync_state IS NOT NULL) to every
 * bidirectional OAuth calendar. No pull — used by the debounced post-edit trigger
 * so a quick edit reaches the provider without paying for a full sync.
 */
export async function runCalendarPush(): Promise<RunSyncSummary> {
  const supabase = createClient();
  const { data: calendars } = await supabase
    .from("external_calendars")
    .select("*")
    .eq("sync_enabled", true)
    .eq("sync_direction", "bidirectional");

  const summary: RunSyncSummary = {
    configured: calendars?.length ?? 0,
    created: 0,
    updated: 0,
    archived: 0,
    pushed: 0,
    errors: [],
  };
  if (!calendars?.length) return summary;

  const list = calendars as ExternalCalendar[];
  const tokenCache = await mintTokens(list.map((c) => c.provider));

  const results = await Promise.allSettled(
    list
      .filter((cal) => OAUTH_PROVIDERS.includes(cal.provider))
      .map(async (cal) => {
        const token = tokenCache.get(cal.provider);
        if (!token) throw new Error(`${cal.provider} needs reconnecting`);
        const adapter = getAdapter(cal.provider);
        await adapter.initialize({ externalCalendar: cal, accessToken: token });
        return pushPendingEvents(cal, adapter);
      }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      summary.pushed += r.value.pushed;
      summary.errors.push(...r.value.errors);
    } else {
      summary.errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }

  return summary;
}
