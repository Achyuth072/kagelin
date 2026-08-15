export const SIGNUP_DISABLED_MESSAGE =
  "This app is private. Only authorized users can sign in.";

export function isSignupDisabledError(message: string): boolean {
  return (
    message.includes("Signups not allowed") ||
    message.includes("signup_disabled")
  );
}
