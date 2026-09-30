import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RequireUserResult =
  | { user: { id: string }; supabase: SupabaseServerClient; error: null }
  | { user: null; supabase: null; error: NextResponse };

// Verified from local JWT claims; revoked sessions stay valid until token
// expiry. Routes requiring immediate revocation must call auth.getUser().
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: { id: userId }, supabase, error: null };
}
