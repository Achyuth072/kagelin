-- =============================================================================
-- Broaden handle_new_user display_name fallback
-- =============================================================================
-- Broadens the display-name fallback logic in handle_new_user from:
--   full_name -> email
-- to:
--   full_name -> name -> username -> email
--
-- Note for manual verification pass: confirm which of name/user_name/preferred_username/etc.
-- GitHub and GitLab actually populate in raw_user_meta_data, and adjust the fallback
-- order if this assumption is wrong.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (use ON CONFLICT to avoid duplicates)
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'username',
      NEW.email
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default Inbox project (only if not exists)
  INSERT INTO public.projects (user_id, name, is_inbox)
  SELECT NEW.id, 'Inbox', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE user_id = NEW.id AND is_inbox = true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
