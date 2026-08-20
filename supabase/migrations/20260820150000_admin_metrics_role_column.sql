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
REVOKE UPDATE (is_admin) ON public.profiles FROM authenticated;
