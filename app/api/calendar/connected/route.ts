import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const OAUTH_PROVIDERS = ["google", "outlook"];

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
    admin
      .from("calendar_oauth_tokens")
      .select("provider")
      .eq("user_id", user.id),
    admin.from("external_calendars").select("provider").eq("user_id", user.id),
  ]);

  const providers = (tokenRows ?? []).map(
    (r: { provider: string }) => r.provider,
  );

  // A provider the user opted into (has external_calendars rows) but whose token
  // row is gone was revoked out from under us — get-access-token deletes the row
  // on invalid_grant, and Google auto-revokes after 7 days while the app is in
  // "Testing". A deliberate disconnect deletes the external_calendars rows too,
  // so this only ever flags a genuine "reconnect needed" state, never that.
  const connected = new Set(providers);
  const needsReconnect = [
    ...new Set(
      (calendarRows ?? [])
        .map((r: { provider: string }) => r.provider)
        .filter((p) => OAUTH_PROVIDERS.includes(p) && !connected.has(p)),
    ),
  ];

  return NextResponse.json({ providers, needsReconnect });
}
