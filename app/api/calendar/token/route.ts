import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/api/require-user";
import { getProviderAccessToken } from "@/lib/calendar-oauth/get-access-token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  if (provider === "google_tasks" || provider === "microsoft_tasks") {
    const cookieName = `${provider}_temp_token`;
    const cookieStore = await cookies();
    const tempToken = cookieStore.get(cookieName)?.value;
    if (!tempToken) {
      return NextResponse.json({ disconnected: true }, { status: 401 });
    }
    // Delete cookie immediately upon consumption (transient one-time pull)
    cookieStore.delete(cookieName);
    return NextResponse.json({
      access_token: tempToken,
      expires_at: Date.now() + 3600 * 1000,
    });
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
