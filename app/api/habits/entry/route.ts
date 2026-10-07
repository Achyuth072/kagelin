import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";

const schema = z.object({
  habitId: z.string().uuid(),
  date: z.iso.date(),
  state: z.enum(["done", "skipped"]),
});

export async function POST(request: Request) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return authError;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { habitId, date, state } = parsed.data;

  const { data: outcome, error } = await supabase.rpc("record_habit_entry", {
    p_habit_id: habitId,
    p_date: date,
    p_state: state,
  });

  if (error) {
    console.error("[habits/entry] Upsert failed", error);
    return NextResponse.json(
      { error: "Failed to save entry" },
      { status: 500 },
    );
  }

  if (outcome === "not_found") {
    return NextResponse.json({ error: "Habit not found" }, { status: 400 });
  }
  if (outcome === "measurable") {
    return NextResponse.json(
      { error: "done is not valid for measurable habits" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
