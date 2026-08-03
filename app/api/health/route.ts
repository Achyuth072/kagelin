import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERY_WINDOW_MS = 30 * 60 * 1000;
const DEGRADED_FAILED_THRESHOLD = 3;

const DB_UNREACHABLE_RESPONSE = {
  status: "error" as const,
  database: "unreachable" as const,
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function countByStatus(
  admin: AdminClient,
  status: "sent" | "failed",
  windowStart: string,
): Promise<number> {
  const anchorColumn = status === "sent" ? "sent_at" : "scheduled_at";
  const { count, error } = await admin
    .from("notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .gte(anchorColumn, windowStart);

  if (error) throw error;
  return count ?? 0;
}

async function countOverduePending(
  admin: AdminClient,
  windowStart: string,
  nowIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from("notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("scheduled_at", windowStart)
    // COALESCE(next_attempt_at, scheduled_at) <= now()
    .or(
      `next_attempt_at.lte.${nowIso},and(next_attempt_at.is.null,scheduled_at.lte.${nowIso})`,
    );

  if (error) throw error;
  return count ?? 0;
}

async function getNotificationHealth() {
  // Admin client — RLS would otherwise scope this to a single user.
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - DELIVERY_WINDOW_MS,
  ).toISOString();
  const nowIso = now.toISOString();

  const [sent, failed, pending] = await Promise.all([
    countByStatus(admin, "sent", windowStart),
    countByStatus(admin, "failed", windowStart),
    countOverduePending(admin, windowStart, nowIso),
  ]);

  return { sent, failed, pending };
}

// Public route (see middleware.ts) so monitors get 200/503, not a login redirect.
export async function GET() {
  const supabase = await createClient();

  const [dbCheck, notificationsResult] = await Promise.allSettled([
    supabase.from("profiles").select("id", { head: true }),
    getNotificationHealth(),
  ]);

  if (dbCheck.status === "rejected" || dbCheck.value.error) {
    return NextResponse.json(DB_UNREACHABLE_RESPONSE, { status: 503 });
  }

  if (notificationsResult.status === "rejected") {
    return NextResponse.json(DB_UNREACHABLE_RESPONSE, { status: 503 });
  }
  const notifications = notificationsResult.value;

  const status =
    notifications.sent === 0 &&
    notifications.failed >= DEGRADED_FAILED_THRESHOLD
      ? "degraded"
      : "ok";

  return NextResponse.json({ status, notifications });
}
