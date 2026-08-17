-- =============================================================================
-- Broaden handle_new_user display_name fallback
-- =============================================================================
-- Falls back through provider-specific metadata fields before defaulting to email:
--   full_name -> name -> user_name -> email
-- GitHub sets user_name (and preferred_username, same value) from the login;
-- GitLab sets neither, so it falls through name/full_name to email. Verified
-- against Supabase Auth's provider mapping (internal/api/provider/{github,gitlab}.go).
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      NEW.email
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (user_id, name, is_inbox)
  SELECT NEW.id, 'Inbox', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE user_id = NEW.id AND is_inbox = true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
