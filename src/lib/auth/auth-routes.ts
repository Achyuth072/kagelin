export const EMAIL_CONFIRMED_PATH = "/auth/email-confirmed";

// Routes whose own redirect swallows the bounce before "/" ever renders.
export const AUTH_STANDALONE_ROUTES: readonly string[] = [
  "/login",
  "/signup",
  "/auth/update-password",
  EMAIL_CONFIRMED_PATH,
];

// Not in AUTH_STANDALONE_ROUTES: these still need the app shell, only the back-anchor bounce is skipped.
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
