import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProviderAccessToken } from "@/lib/calendar-oauth/get-access-token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token;
  try {
    token = await getProviderAccessToken(user.id, provider);
  } catch (e) {
    // Transient token-endpoint failure — token row is preserved; retry later.
    console.error("[calendar-token] exchange failed:", e);
    return NextResponse.json(
      { error: "token_exchange_failed" },
      { status: 502 },
    );
  }

  if (!token) {
    // No token row, or provider revoked access (row was cleared)
    return NextResponse.json({ disconnected: true }, { status: 401 });
  }

  return NextResponse.json({
    access_token: token.accessToken,
    expires_at: token.expiresAt,
  });
}
