import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RequireUserResult =
  | { user: User; supabase: SupabaseServerClient; error: null }
  | { user: null; supabase: null; error: NextResponse };

/**
 * Resolve the authenticated user for an API route, or a ready-to-return 401.
 * Also hands back the Supabase client so routes that go on to query don't
 * have to create a second one.
 *
 * Usage:
 *   const { user, supabase, error } = await requireUser();
 *   if (error) return error;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, supabase, error: null };
}
