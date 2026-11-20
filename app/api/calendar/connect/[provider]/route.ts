import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { generatePKCE } from "@/lib/calendar-oauth/pkce";
import {
  getOAuthRedirectUri,
  isValidReturnTo,
  getOAuthCredentials,
} from "@/lib/calendar-oauth/app-url";

const PROVIDER_AUTH_URLS: Record<string, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  google_tasks: "https://accounts.google.com/o/oauth2/v2/auth",
  outlook: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
};

const PROVIDER_SCOPES: Record<string, string> = {
  google: "https://www.googleapis.com/auth/calendar openid email",
  google_tasks: "https://www.googleapis.com/auth/tasks.readonly openid email",
  outlook:
    "https://graph.microsoft.com/Calendars.ReadWrite offline_access openid email",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!PROVIDER_AUTH_URLS[provider]) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set(`calendar_oauth_verifier`, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  cookieStore.set(`calendar_oauth_state`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  cookieStore.set(`calendar_oauth_provider`, provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  const returnTo = new URL(request.url).searchParams.get("return_to");
  if (isValidReturnTo(returnTo)) {
    cookieStore.set("calendar_oauth_return_to", returnTo!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
  }

  const { clientId } = getOAuthCredentials(provider);

  const redirectUri = getOAuthRedirectUri(request);
  const url = new URL(PROVIDER_AUTH_URLS[provider]);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PROVIDER_SCOPES[provider]);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }

  return NextResponse.redirect(url.toString());
}
