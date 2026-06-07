import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client for server-only route handlers.
 *
 * Bypasses RLS — use ONLY in trusted server code after verifying the user's
 * session with the publishable/anon client (see createClient in ./server).
 * Required for tables with no client-facing policies, e.g. calendar_oauth_tokens,
 * where the browser must never read the encrypted refresh tokens.
 *
 * Accepts the new Supabase secret key (sb_secret_…) or the legacy service_role
 * key — both bypass RLS. Never import this into a client component.
 */
export function createAdminClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is not set",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
