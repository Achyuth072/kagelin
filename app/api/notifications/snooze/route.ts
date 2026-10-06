import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";

const schema = z.object({
  type: z.enum(["due_date", "do_date", "event_reminder"]),
  referenceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return authError;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { data: outcome, error } = await supabase.rpc("snooze_reminder", {
    p_type: parsed.data.type,
    p_reference_id: parsed.data.referenceId,
  });

  if (error) {
    console.error("[notifications/snooze] Snooze failed", error);
    return NextResponse.json(
      { error: "Failed to snooze reminder" },
      { status: 500 },
    );
  }

  if (outcome === "not_found") {
    return NextResponse.json({ error: "Reminder not found" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
