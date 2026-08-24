// Per RESEARCH.md Section 3.2: all adapters (CalDAV, Google, Microsoft) implement
// this interface, enabling provider-agnostic sync orchestration.

import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  CalendarProvider,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";

export interface SyncAdapterConfig {
  externalCalendar: ExternalCalendar;
  /** CalDAV password (user-provided on each sync) */
  password?: string;
  /** OAuth access token (for Google/Microsoft, from Supabase Auth) */
  accessToken?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  pushed: number;
  errors: string[];
  newSyncToken: string | null;
}

/** Remote event representation, normalized across providers. */
export interface RemoteEvent {
  /** Provider-specific ID (URL for CalDAV, eventId for Google, id for MS) */
  remoteId: string;
  /** ETag or equivalent for change detection */
  etag: string;
  /** Raw ICS data (CalDAV) or normalized event object */
  data: string | Record<string, unknown>;
  /** Last modified timestamp */
  updatedAt?: Date;
  /** Kagelin local event ID stamped on create — used for interrupted-create reconciliation */
  kansoId?: string;
}

export interface SyncDelta {
  created: RemoteEvent[];
  updated: RemoteEvent[];
  deleted: string[]; // Remote IDs of deleted events
  newSyncToken: string;
}

export interface SyncAdapter {
  /** The provider this adapter handles */
  readonly provider: CalendarProvider;

  initialize(config: SyncAdapterConfig): Promise<void>;

  discoverCalendars(): Promise<DiscoveredCalendar[]>;

  /** No sync token yet; default window is 90 days past / 365 days future. */
  fullSync(
    pastDays?: number,
    futureDays?: number,
  ): Promise<{
    events: RemoteEvent[];
    syncToken: string;
  }>;

  /** @param syncToken CTag (CalDAV), nextSyncToken (Google), or deltaLink (MS). */
  incrementalSync(syncToken: string): Promise<SyncDelta>;

  pushEvent(event: CalendarEvent): Promise<{ remoteId: string; etag: string }>;

  updateRemoteEvent(
    remoteId: string,
    event: CalendarEvent,
  ): Promise<{ etag: string }>;

  deleteRemoteEvent(remoteId: string): Promise<void>;

  /** Provider-specific parsing: ICS for CalDAV, JSON for Google/MS. */
  parseRemoteEvent(remote: RemoteEvent): CreateCalendarEventInput | null;
}

const ADAPTER_REGISTRY: Partial<Record<CalendarProvider, () => SyncAdapter>> =
  {};

export function registerAdapter(
  provider: CalendarProvider,
  factory: () => SyncAdapter,
): void {
  ADAPTER_REGISTRY[provider] = factory;
}

export function getAdapter(provider: CalendarProvider): SyncAdapter {
  const factory = ADAPTER_REGISTRY[provider];
  if (!factory) {
    throw new Error(`No sync adapter registered for provider: ${provider}`);
  }
  return factory();
}
