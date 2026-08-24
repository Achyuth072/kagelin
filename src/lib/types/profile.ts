export interface Profile {
  id: string;
  display_name: string | null;
  settings: UserSettings;
  timezone: string;
  is_premium: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// Mirrors the column-level GRANT on public.profiles. Every other column is
// non-writable by the `authenticated` role, so widening this without widening
// the GRANT buys a runtime 42501 instead of a compile error.
export type EditableProfileFields = Pick<
  Profile,
  "display_name" | "settings" | "timezone"
>;

export interface UserSettings {
  notifications?: {
    morning_briefing: boolean;
    evening_plan: boolean;
    due_date_alerts: boolean;
    do_date_alerts: boolean;
    timer_alerts: boolean;
  };
  // Admin-only: where an admin lands after login. Irrelevant (and unused)
  // for non-admin accounts.
  adminLandingPage?: "tasks" | "metrics";
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notifications: {
    morning_briefing: true,
    evening_plan: true,
    due_date_alerts: true,
    do_date_alerts: true,
    timer_alerts: true,
  },
  adminLandingPage: "tasks",
};
