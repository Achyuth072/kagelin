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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getProviderAccessToken(user.id, provider);
  if (!token) {
    // No token row, or provider revoked access (row was cleared)
    return NextResponse.json({ disconnected: true }, { status: 401 });
  }

  return NextResponse.json({
    access_token: token.accessToken,
    expires_at: token.expiresAt,
  });
}
