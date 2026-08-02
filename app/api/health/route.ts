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

// `sent_at` is when delivery actually happened; `scheduled_at` is immutable
// ("when this was meant to fire", see schema.sql) so it's the only anchor
// shared by failed/pending rows, which have no completion timestamp.
async function countByStatus(
  admin: AdminClient,
  status: "sent" | "failed",
  anchorColumn: "sent_at" | "scheduled_at",
  windowStart: string,
): Promise<number> {
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
  // RLS scopes notification_queue to user_id = auth.uid(); an unauthenticated
  // health check needs the admin client to see counts across all users.
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - DELIVERY_WINDOW_MS,
  ).toISOString();
  const nowIso = now.toISOString();

  const [sent, failed, pending] = await Promise.all([
    countByStatus(admin, "sent", "sent_at", windowStart),
    countByStatus(admin, "failed", "scheduled_at", windowStart),
    countOverduePending(admin, windowStart, nowIso),
  ]);

  return { sent, failed, pending };
}

// Public route (middleware.ts isPublicRoute) so an unauthenticated monitor
// gets a real 200/503 instead of a redirect to /login.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .select("id", { head: true });

  if (error) {
    return NextResponse.json(DB_UNREACHABLE_RESPONSE, { status: 503 });
  }

  let notifications;
  try {
    notifications = await getNotificationHealth();
  } catch {
    return NextResponse.json(DB_UNREACHABLE_RESPONSE, { status: 503 });
  }

  const status =
    notifications.sent === 0 &&
    notifications.failed >= DEGRADED_FAILED_THRESHOLD
      ? "degraded"
      : "ok";

  return NextResponse.json({ status, notifications });
}
