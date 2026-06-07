import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  // Service-role: token table has no client-facing policies; other queries are
  // all explicitly scoped to the verified user.id below.
  const admin = createAdminClient();

  // Delete the encrypted token
  await admin
    .from("calendar_oauth_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  // Archive locally-stored events that came from this provider's calendars
  const { data: providerCalendars } = await admin
    .from("external_calendars")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (providerCalendars?.length) {
    const calendarIds = providerCalendars.map((c: { id: string }) => c.id);
    await admin
      .from("calendar_events")
      .update({ is_archived: true })
      .eq("user_id", user.id)
      .in("remote_calendar_id", calendarIds);

    await admin
      .from("external_calendars")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);
  }

  return NextResponse.json({ ok: true });
}
