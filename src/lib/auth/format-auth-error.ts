export const SIGNUP_DISABLED_MESSAGE =
  "This app is private. Only authorized users can sign in.";

export function isSignupDisabledError(message: string): boolean {
  return (
    message.includes("Signups not allowed") ||
    message.includes("signup_disabled")
  );
}

export function formatLinkError(
  error: { code?: string; message?: string } | Error | string,
  providerLabel = "social",
): string {
  const message = typeof error === "string" ? error : error.message || "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  const isAlreadyLinked =
    code === "identity_already_exists" ||
    /already (linked|exists|claimed)/i.test(message);

  return isAlreadyLinked
    ? `That ${providerLabel} account is already linked to a different Kagelin account.`
    : message;
}
