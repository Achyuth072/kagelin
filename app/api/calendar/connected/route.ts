import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { OAUTH_PROVIDERS } from "@/lib/types/external-calendar";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ providers: [], needsReconnect: [] });
  }

  // Service-role: calendar_oauth_tokens has no client-facing RLS policies
  const admin = createAdminClient();
  const [{ data: tokenRows }, { data: calendarRows }] = await Promise.all([
    // eslint-disable-next-line local/no-unbounded-supabase-select -- one row per provider per user
    admin
      .from("calendar_oauth_tokens")
      .select("provider")
      .eq("user_id", user.id),
    // eslint-disable-next-line local/no-unbounded-supabase-select -- handful of calendars per user
    admin.from("external_calendars").select("provider").eq("user_id", user.id),
  ]);

  const providers = (tokenRows ?? []).map((r) => r.provider);

  // A provider with external_calendars rows whose token is missing was revoked
  // externally (e.g. Google 7-day Testing expiry or invalid_grant).
  const calendarProviders = new Set(
    (calendarRows ?? []).map((r) => r.provider),
  );
  const needsReconnect = OAUTH_PROVIDERS.filter(
    (p) => calendarProviders.has(p) && !providers.includes(p),
  );

  return NextResponse.json({ providers, needsReconnect });
}
