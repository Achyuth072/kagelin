import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeAuthCode } from "@/lib/calendar-oauth/auth-code-exchange";
import { encryptRefreshToken } from "@/lib/calendar-oauth/token-crypto";
import { getAppBaseUrl } from "@/lib/calendar-oauth/app-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Pin to the canonical app URL, not the request origin: behind Vercel's proxy
  // the origin can be an internal host, which both breaks the token exchange
  // (redirect_uri must match the connect route) and would bounce the user to a
  // domain where their session cookie is absent.
  const baseUrl = getAppBaseUrl(request);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${baseUrl}/calendar?oauth_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/calendar?oauth_error=missing_params`,
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("calendar_oauth_state")?.value;
  const codeVerifier = cookieStore.get("calendar_oauth_verifier")?.value;
  const provider = cookieStore.get("calendar_oauth_provider")?.value;

  if (!storedState || storedState !== state || !codeVerifier || !provider) {
    return NextResponse.redirect(
      `${baseUrl}/calendar?oauth_error=invalid_state`,
    );
  }

  // Clear PKCE / state cookies
  cookieStore.delete("calendar_oauth_state");
  cookieStore.delete("calendar_oauth_verifier");
  cookieStore.delete("calendar_oauth_provider");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  try {
    const redirectUri = `${baseUrl}/api/calendar/oauth/callback`;
    const { refreshToken } = await exchangeAuthCode({
      provider,
      code,
      codeVerifier,
      redirectUri,
    });

    const encKey = process.env.CALENDAR_TOKEN_ENC_KEY;
    if (!encKey) throw new Error("CALENDAR_TOKEN_ENC_KEY not set");

    const { ciphertext, iv } = await encryptRefreshToken(refreshToken, encKey);

    // Service-role client: calendar_oauth_tokens has no client-facing RLS policies
    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from("calendar_oauth_tokens")
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_refresh_token: ciphertext,
          token_iv: iv,
        },
        { onConflict: "user_id,provider" },
      );
    if (upsertError)
      throw new Error(`Token upsert failed: ${upsertError.message}`);

    return NextResponse.redirect(`${baseUrl}/calendar?connected=${provider}`);
  } catch (e) {
    console.error("[calendar-oauth-callback] connect failed:", e);
    const reason = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(
      `${baseUrl}/calendar?oauth_error=${encodeURIComponent(reason)}`,
    );
  }
}
