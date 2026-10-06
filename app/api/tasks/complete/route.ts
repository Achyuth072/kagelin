import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";

const schema = z.object({ taskId: z.string().uuid() });

export async function POST(request: Request) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return authError;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { data: outcome, error } = await supabase.rpc(
    "complete_task_from_notification",
    { p_task_id: parsed.data.taskId },
  );

  if (error) {
    console.error("[tasks/complete] Complete failed", error);
    return NextResponse.json(
      { error: "Failed to complete task" },
      { status: 500 },
    );
  }

  if (outcome === "not_found") {
    return NextResponse.json({ error: "Task not found" }, { status: 400 });
  }
  if (outcome === "recurring") {
    return NextResponse.json(
      { error: "Recurring tasks are completed in the app" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
