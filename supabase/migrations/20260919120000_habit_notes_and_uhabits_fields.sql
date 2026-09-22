ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS reminder_time TEXT,
  ADD COLUMN IF NOT EXISTS reminder_days INT NOT NULL DEFAULT 127;

ALTER TABLE public.habit_entries
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- REAL (not NUMERIC) avoids PostgREST serializing NUMERIC as a string.
ALTER TABLE public.habit_entries
  ALTER COLUMN value TYPE REAL;

-- Unchecking a day used to upsert value 0; it now deletes the entry, and value 0
-- means an explicit "not done" (shown as a miss). Before this, nothing else wrote
-- 0 to a non-measurable habit, so these rows are all stale unchecks.
--
-- Production has no PITR: this is the only way back if the stale-uncheck premise
-- is wrong for some account. Safe to drop once a release ships without complaints.
CREATE TABLE IF NOT EXISTS public.habit_entries_stale_uncheck_backup (
  LIKE public.habit_entries INCLUDING DEFAULTS
);

-- No policies: RLS with none denies every PostgREST caller outright.
ALTER TABLE public.habit_entries_stale_uncheck_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habit_entries_stale_uncheck_backup FROM anon, authenticated;

DO $cleanup$
DECLARE
  removed BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.habit_entries e
    USING public.habits h
    WHERE e.habit_id = h.id
      AND e.value = 0
      AND h.habit_type IS DISTINCT FROM 'measurable'
      AND e.notes IS NULL
      -- Only rows that predate this migration can be stale unchecks; anything
      -- written afterwards is an explicit miss from the new client.
      AND e.created_at < TIMESTAMPTZ '2026-09-19 12:00:00+00'
    RETURNING e.*
  )
  INSERT INTO public.habit_entries_stale_uncheck_backup
  SELECT * FROM deleted;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE 'stale-uncheck cleanup removed % habit_entries row(s); originals retained in public.habit_entries_stale_uncheck_backup', removed;
END
$cleanup$;

DROP TRIGGER IF EXISTS habits_reject_unmigrated_plaintext ON public.habits;
CREATE TRIGGER habits_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext('name', 'description', 'question');

-- habit_entries has no user_id column, so ownership resolves through the parent habit.
CREATE OR REPLACE FUNCTION public.reject_unmigrated_plaintext_habit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_migrated BOOLEAN;
BEGIN
  IF NEW.notes IS NULL OR NEW.notes LIKE 'xchacha20poly1305-v1:%' THEN
    RETURN NEW;
  END IF;

  SELECT k.migrated_at IS NOT NULL INTO is_migrated
  FROM public.habits h
  JOIN public.encryption_keys k ON k.user_id = h.user_id
  WHERE h.id = NEW.habit_id;

  IF COALESCE(is_migrated, FALSE) THEN
    RAISE EXCEPTION 'Column habit_entries.notes must be encrypted once a user has completed content-key setup'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS habit_entries_reject_unmigrated_plaintext ON public.habit_entries;
CREATE TRIGGER habit_entries_reject_unmigrated_plaintext
  BEFORE INSERT OR UPDATE ON public.habit_entries
  FOR EACH ROW EXECUTE FUNCTION public.reject_unmigrated_plaintext_habit_entry();
