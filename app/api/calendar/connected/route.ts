import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ providers: [] });
  }

  // Service-role: calendar_oauth_tokens has no client-facing RLS policies
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_oauth_tokens")
    .select("provider")
    .eq("user_id", user.id);

  const providers = (data ?? []).map((r: { provider: string }) => r.provider);
  return NextResponse.json({ providers });
}
