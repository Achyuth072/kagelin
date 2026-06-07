import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

type RequireUserResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

/**
 * Resolve the authenticated user for an API route, or a ready-to-return 401.
 *
 * Usage:
 *   const { user, error } = await requireUser();
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
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, error: null };
}
