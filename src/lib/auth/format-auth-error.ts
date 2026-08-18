export const SIGNUP_DISABLED_MESSAGE =
  "This app is private. Only authorized users can sign in.";

export const GENERIC_LINK_ERROR_MESSAGE =
  "Failed to link account. Please try again.";

export function isSignupDisabledError(message: string): boolean {
  return (
    message.includes("Signups not allowed") ||
    message.includes("signup_disabled")
  );
}

export function formatLinkError(
  error: { code?: string; message?: string } | Error | string,
  providerLabel = "social",
  // Carries GoTrue's `error_code` when `error` arrived as a bare redirect
  // string with no `.code` of its own — see app/auth/callback/route.ts.
  redirectErrorCode?: string | null,
): string {
  const message = typeof error === "string" ? error : error.message || "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : redirectErrorCode;

  const isAlreadyLinked =
    code === "identity_already_exists" ||
    // Fallback for the rare case a code isn't available: matches GoTrue's
    // current wording, so it breaks (safely, to the raw message) if that
    // prose is ever reworded.
    /already (linked|exists|claimed)/i.test(message);

  if (isAlreadyLinked) {
    return `That ${providerLabel} account is already linked to a different Kagelin account.`;
  }

  // A string `error` only ever arrives from the `?error`/`?error_description`
  // redirect params (attacker-controlled, unlike the AuthError objects the
  // other call sites pass) — substitute a fixed message instead of
  // reflecting it, mirroring AuthPage's handling of the same params.
  return typeof error === "string" ? GENERIC_LINK_ERROR_MESSAGE : message;
}
