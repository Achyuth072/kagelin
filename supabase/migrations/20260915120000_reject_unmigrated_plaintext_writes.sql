-- Rejects plaintext writes once content encryption is complete (migrated_at set)
-- to prevent stale clients from persisting unencrypted content.
--
-- `to_jsonb(NEW) -> col #>> '{}'` unwraps both TEXT and JSONB columns uniformly
-- into text scalars for the ciphertext prefix check.

CREATE OR REPLACE FUNCTION public.reject_unmigrated_plaintext()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_migrated BOOLEAN;
  col TEXT;
  val TEXT;
BEGIN
  SELECT migrated_at IS NOT NULL INTO is_migrated
  FROM public.encryption_keys
  WHERE user_id = NEW.user_id;

  IF NOT COALESCE(is_migrated, FALSE) THEN
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY TG_ARGV LOOP
    val := (to_jsonb(NEW) -> col) #>> '{}';
    IF val IS NOT NULL AND val NOT LIKE 'xchacha20poly1305-v1:%' THEN
      RAISE EXCEPTION 'Column %.% must be encrypted once a user has completed content-key setup', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('content', 'description');

CREATE TRIGGER habits_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('name', 'description');

CREATE TRIGGER projects_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('name');

CREATE TRIGGER labels_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('name');

CREATE TRIGGER calendar_events_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('title', 'description', 'location', 'category', 'metadata');

CREATE TRIGGER external_calendars_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.external_calendars
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('name', 'username');

CREATE TRIGGER habit_imports_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.habit_imports
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('raw', 'file_name');
