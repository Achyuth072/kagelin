/**
 * Canonical public base URL of the app.
 *
 * OAuth requires the redirect_uri to be byte-identical between the authorization
 * request and the token exchange. Deriving it from the request origin is unsafe
 * behind Vercel's proxy — the origin can be an internal deployment host
 * (`*.vercel.app`) rather than the public domain — so pin it to
 * NEXT_PUBLIC_APP_URL and fall back to the request origin only when unset
 * (local dev). Both the connect and callback routes MUST use this so the two
 * redirect_uris can never diverge.
 */
export function getAppBaseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export function getOAuthRedirectUri(request: Request): string {
  return `${getAppBaseUrl(request)}/api/calendar/oauth/callback`;
}
