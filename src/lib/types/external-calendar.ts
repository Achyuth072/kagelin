/**
 * External Calendar Types
 * Matches supabase external_calendars table schema
 * Supports: CalDAV (all users), Google/Outlook OAuth (registered users)
 */

export type SyncStatus = "pending" | "syncing" | "success" | "error";
export type SyncDirection = "bidirectional" | "pull" | "push";

/**
 * All supported calendar providers
 * - CalDAV-based: 'caldav', 'icloud', 'fastmail', 'nextcloud'
 * - Native OAuth: 'google', 'outlook' (registered users only — needs auth.uid())
 */
export type CalendarProvider =
  | "caldav"
  | "google"
  | "outlook"
  | "icloud"
  | "fastmail"
  | "nextcloud";

/** Providers that use CalDAV protocol */
export const CALDAV_PROVIDERS: CalendarProvider[] = [
  "caldav",
  "icloud",
  "fastmail",
  "nextcloud",
];

export interface ExternalCalendar {
  id: string;
  user_id: string;

  // Provider Info
  provider: CalendarProvider;
  name: string;
  color: string;

  // Connection Details (varies by provider)
  server_url: string | null; // CalDAV only
  calendar_url: string | null;
  principal_url: string | null; // CalDAV only

  // Auth
  username: string | null; // CalDAV only

  // OAuth Provider Specifics (for Google/Outlook)
  oauth_provider_token_id: string | null;
  remote_calendar_id: string | null; // Google Calendar ID or Outlook folder ID

  // Sync State
  sync_token: string | null; // CTag (CalDAV), nextSyncToken (Google), deltaLink (MS Graph)
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;

  // Settings
  sync_enabled: boolean;
  sync_direction: SyncDirection;

  // Feature Gating
  is_premium_provider: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface UpdateExternalCalendarInput {
  id: string;
  name?: string;
  color?: string;
  sync_enabled?: boolean;
  sync_direction?: SyncDirection;
  sync_token?: string;
  last_sync_at?: string;
  sync_status?: SyncStatus;
  sync_error?: string;
  calendar_url?: string;
  principal_url?: string;
  remote_calendar_id?: string;
}

/**
 * CalDAV discovery result
 */
export interface DiscoveredCalendar {
  url: string;
  displayName: string;
  description?: string;
  color?: string;
  ctag?: string;
}

/**
 * Google Calendar list item (from Google Calendar API)
 */
export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
}

/**
 * Microsoft Graph calendar (from MS Graph API)
 */
export interface MicrosoftCalendarListItem {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
}
