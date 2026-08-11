-- =============================================================================
-- Founding-tester waitlist: bring the table into this migration stream and
-- grant Premium to the founding cohort on signup
-- =============================================================================
-- waitlist_signups previously lived only as a loose file in kagelin-web
-- (supabase/waitlist_signups.sql, deleted as of this change), outside any
-- migration stream, even though it's the same Postgres instance as this app.
-- Moving it here so a from-scratch rebuild of this database doesn't silently
-- drop a table handle_email_confirmed() is about to depend on. The live
-- table already exists with that old file's 4-column shape — CREATE TABLE
-- IF NOT EXISTS below is a no-op against it, so the two new columns are
-- added separately via ALTER TABLE ... ADD COLUMN IF NOT EXISTS, which
-- converges both a fresh DB and the existing one to the same 6-column shape.
--
-- Premium is granted by founding-cohort membership, not by invite — see
-- CONTEXT.md "Founding cohort" / "Invited" / "Founding grant".
--
-- The grant is NOT done from handle_new_user() (AFTER INSERT ON auth.users).
-- For the PKCE magic-link flow this app uses, that row is created —
-- unconfirmed — the moment signInWithOtp() is called, before the email is
-- ever proven owned; the confirmation only happens later, as an UPDATE, when
-- the emailed link is followed (app/auth/callback exchanges the code).
-- Keying the grant off INSERT would let anyone request a magic link for a
-- founding-cohort member's address and stamp their grant without ever
-- proving they own that inbox. So this is its own trigger, firing only on
-- the email_confirmed_at NULL → not-NULL transition.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  cohort      TEXT NOT NULL DEFAULT 'founding'
              CHECK (cohort IN ('founding', 'general')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_granted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_key
  ON public.waitlist_signups (email);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;
GRANT ALL ON public.waitlist_signups TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Founding grant: membership in the founding cohort earns Premium the
  -- moment the person confirms they own the app account's email —
  -- independent of invite order. Stamp public.profiles first and only mark
  -- waitlist_signups.premium_granted_at once that UPDATE actually found a
  -- row: premium_granted_at is provenance, not just an idempotency flag, so
  -- it must not go non-NULL for a grant that didn't land (e.g. if the
  -- profiles row doesn't exist yet because on_auth_user_created hasn't run —
  -- see the trigger-ordering note below). The WHERE below is still what
  -- prevents re-granting on a second call.
  UPDATE public.profiles
  SET is_premium = true
  WHERE id = NEW.id
    AND EXISTS (
      SELECT 1 FROM public.waitlist_signups
      WHERE email = NEW.email
        AND cohort = 'founding'
        AND premium_granted_at IS NULL
    );

  IF FOUND THEN
    UPDATE public.waitlist_signups
    SET premium_granted_at = now()
    WHERE email = NEW.email
      AND cohort = 'founding'
      AND premium_granted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION handle_email_confirmed() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_email_confirmed();

-- The UPDATE trigger above only covers rows confirmed *after* creation. OAuth
-- providers vouch for the email themselves, so Supabase stamps
-- email_confirmed_at at INSERT and that transition never happens — without
-- this second trigger an OAuth signup would silently never be granted. Added
-- ahead of any OAuth provider existing, so this migration isn't revisited.
--
-- Name matters: triggers on the same event fire in alphabetical order, and
-- on_auth_user_created (which inserts the profiles row) must run first or the
-- is_premium UPDATE in handle_email_confirmed() above finds nothing.
--
-- This makes Supabase's "Confirm email" setting load-bearing: turn it off and
-- password signups also arrive confirmed, letting anyone claim a founding
-- member's grant by typing their address. Keep it on.
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_insert ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_email_confirmed();

-- One-time backfill for anyone who confirmed their app account before this
-- migration existed to grant Premium on confirmation. Scoped via a CTE +
-- RETURNING so the profiles UPDATE only touches the rows this backfill just
-- stamped — matching on `premium_granted_at IS NOT NULL` directly would also
-- re-flip is_premium for any founding row granted (and since revoked) long
-- before this migration ran.
WITH backfilled AS (
  UPDATE public.waitlist_signups w
  SET premium_granted_at = now()
  FROM auth.users u
  WHERE u.email = w.email
    AND u.email_confirmed_at IS NOT NULL
    AND w.cohort = 'founding'
    AND w.premium_granted_at IS NULL
  RETURNING w.email
)
UPDATE public.profiles p
SET is_premium = true
FROM auth.users u
JOIN backfilled b ON b.email = u.email
WHERE p.id = u.id
  AND p.is_premium = false;
