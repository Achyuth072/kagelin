-- =============================================================================
-- has_password(): whether the calling user has a password credential set
-- =============================================================================
-- identities has no signal for this: both password sign-up and magic-link/OTP
-- create an `email` identity, so client code can't tell the two apart by
-- checking for one. The password hash lives on auth.users and is never sent
-- to the client, so this reads it server-side and returns only a boolean for
-- the calling user.

CREATE OR REPLACE FUNCTION public.has_password()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT encrypted_password IS NOT NULL AND encrypted_password <> ''
  FROM auth.users
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_password() TO authenticated;
