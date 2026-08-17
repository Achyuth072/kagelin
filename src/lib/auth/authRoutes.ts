export const EMAIL_CONFIRMED_PATH = "/auth/email-confirmed";

// Routes whose own redirect swallows the bounce before "/" ever renders.
export const AUTH_STANDALONE_ROUTES: readonly string[] = [
  "/login",
  "/signup",
  "/auth/update-password",
  EMAIL_CONFIRMED_PATH,
];

// Both routes below are landed on via a cold HTTP redirect from an OAuth
// connect flow — linking an identity from Settings (AuthProvider.linkIdentity)
// or connecting a calendar (app/api/calendar/oauth/callback) — scoped to
// their specific query params rather than added to AUTH_STANDALONE_ROUTES
// wholesale: both still need the app shell (see AppShell's isLoginPage),
// it's only the redirect's back-anchor bounce we skip.
export function isOAuthConnectRedirect(
  pathname: string,
  search: string,
): boolean {
  const params = new URLSearchParams(search);
  if (pathname === "/settings") return params.has("connecting");
  if (pathname === "/calendar")
    return params.has("connected") || params.has("oauth_error");
  return false;
}
