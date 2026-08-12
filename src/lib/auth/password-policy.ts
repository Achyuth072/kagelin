// Mirrors the minimum length enforced in Supabase project config (see
// .planning/82-multi-provider-auth-spec.md — "Password policy"). Shared so
// the sign-up and update-password forms can't drift apart on this number.
export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordTooShort(password: string): boolean {
  return password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
}
