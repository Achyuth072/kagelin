import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ENTRY_VALUE_DONE, ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";

const schema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  state: z.enum(["done", "skipped"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { habitId, date, state } = parsed.data;

  if (state === "done") {
    const { data: habit } = await supabase
      .from("habits")
      .select("habit_type")
      .eq("id", habitId)
      .single();

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 400 });
    }
    if (habit.habit_type === "measurable") {
      return NextResponse.json(
        { error: "done is not valid for measurable habits" },
        { status: 400 },
      );
    }
  }

  const value = state === "done" ? ENTRY_VALUE_DONE : ENTRY_VALUE_SKIPPED;

  const { error } = await supabase
    .from("habit_entries")
    .upsert(
      { habit_id: habitId, date, value },
      { onConflict: "habit_id,date" },
    );

  if (error) {
    console.error("[habits/entry] Upsert failed", error);
    return NextResponse.json(
      { error: "Failed to save entry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
