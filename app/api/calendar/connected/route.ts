import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";

export async function GET() {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  // Service-role: calendar_oauth_tokens has no client-facing RLS policies
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_oauth_tokens")
    .select("provider")
    .eq("user_id", user.id);

  const providers = (data ?? []).map((r: { provider: string }) => r.provider);
  return NextResponse.json({ providers });
}
