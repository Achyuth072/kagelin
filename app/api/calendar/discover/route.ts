import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProviderAccessToken } from "@/lib/calendar-oauth/get-access-token";
import "@/lib/sync/register-adapters";
import { getAdapter } from "@/lib/sync/adapter-interface";
import type {
  CalendarProvider,
  ExternalCalendar,
} from "@/lib/types/external-calendar";

const OAUTH_PROVIDERS: CalendarProvider[] = ["google", "outlook"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as CalendarProvider | null;

  if (!provider || !OAUTH_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token;
  try {
    token = await getProviderAccessToken(user.id, provider);
  } catch (e) {
    // Transient token-endpoint failure — token row is preserved; retry later.
    console.error("[calendar-discover] token exchange failed:", e);
    return NextResponse.json(
      { error: "token_exchange_failed" },
      { status: 502 },
    );
  }

  if (!token) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const adapter = getAdapter(provider);
    // discoverCalendars only needs accessToken; externalCalendar is unused here
    await adapter.initialize({
      externalCalendar: {} as ExternalCalendar,
      accessToken: token.accessToken,
    });
    const calendars = await adapter.discoverCalendars();
    return NextResponse.json({ calendars });
  } catch (e) {
    console.error("[calendar-discover] failed:", e);
    const reason = e instanceof Error ? e.message : "discovery_failed";
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
