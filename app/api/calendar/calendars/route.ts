import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface PickedCalendar {
  remote_calendar_id: string;
  name: string;
  color?: string;
}

// List the user's configured external_calendars (id + remote id + provider)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("external_calendars")
    .select("id, provider, name, remote_calendar_id, sync_enabled")
    .eq("user_id", user.id);

  if (error) {
    console.error("[calendar-calendars:GET] failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calendars: data ?? [] });
}

// Create external_calendars rows for the selected provider calendars
export async function POST(request: Request) {
  const body = await request.json();
  const provider = body.provider as string;
  const picks = (body.calendars ?? []) as PickedCalendar[];

  if (!provider || picks.length === 0) {
    return NextResponse.json(
      { error: "provider and calendars required" },
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

  const admin = createAdminClient();

  // Skip calendars already configured (same user + provider + remote id)
  const { data: existing } = await admin
    .from("external_calendars")
    .select("remote_calendar_id")
    .eq("user_id", user.id)
    .eq("provider", provider);
  const existingIds = new Set(
    (existing ?? []).map(
      (r: { remote_calendar_id: string | null }) => r.remote_calendar_id,
    ),
  );

  const rows = picks
    .filter((c) => !existingIds.has(c.remote_calendar_id))
    .map((c) => ({
      user_id: user.id,
      provider,
      name: c.name,
      color: c.color ?? "#4B6CB7",
      remote_calendar_id: c.remote_calendar_id,
      sync_direction: "bidirectional",
      sync_enabled: true,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  const { data, error } = await admin
    .from("external_calendars")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[calendar-calendars:POST] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newCalendarIds = (data ?? []).map((r: { id: string }) => r.id);

  // Adopt orphaned archived events from this provider's previous connection so
  // they reappear immediately without waiting for a sync cycle. Orphans are
  // archived synced events whose remote_calendar_id references a now-deleted
  // external_calendars row. The sync revive path remains a safety net.
  if (newCalendarIds.length > 0) {
    const [{ data: allCalendars }, { data: archivedSynced }] =
      await Promise.all([
        admin.from("external_calendars").select("id").eq("user_id", user.id),
        admin
          .from("calendar_events")
          .select("id, remote_calendar_id")
          .eq("user_id", user.id)
          .eq("is_archived", true)
          .not("remote_id", "is", null)
          .not("remote_calendar_id", "is", null),
      ]);
    const activeIds = new Set(
      (allCalendars ?? []).map((c: { id: string }) => c.id),
    );

    const orphanIds = (archivedSynced ?? [])
      .filter(
        (e: { id: string; remote_calendar_id: string }) =>
          !activeIds.has(e.remote_calendar_id),
      )
      .map((e: { id: string }) => e.id);

    if (orphanIds.length > 0) {
      await admin
        .from("calendar_events")
        .update({ remote_calendar_id: newCalendarIds[0], is_archived: false })
        .in("id", orphanIds);
    }
  }

  return NextResponse.json({ created: data?.length ?? 0 });
}
