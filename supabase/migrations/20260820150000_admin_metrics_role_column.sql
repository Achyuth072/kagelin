-- =============================================================================
-- profiles.is_admin — replaces the ADMIN_EMAILS env var gate on /admin/metrics
-- =============================================================================
-- Promotable via SQL without a redeploy:
--   UPDATE public.profiles SET is_admin = true WHERE id = '<user-id>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- "Users can update own profile" only checks USING (auth.uid() = id), with no
-- column restriction — without this, any authenticated user could self-grant
-- via supabase.from('profiles').update({ is_admin: true }).
--
-- Column-level REVOKE cannot subtract from Supabase's default table-level
-- GRANT ALL; drop table-level UPDATE and re-grant only user-editable columns.
-- Any column added to profiles later is non-writable by default (fail closed).
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, settings, timezone) ON public.profiles TO authenticated;
