-- Notes are sealed for the row id; upserts on (habit_id, date) must not change it.
CREATE OR REPLACE FUNCTION public.keep_habit_entry_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'habit_entries.id cannot change'
      USING ERRCODE = 'check_violation', HINT = 'habit_entry_id_changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER habit_entries_keep_id
  BEFORE UPDATE ON public.habit_entries
  FOR EACH ROW EXECUTE FUNCTION public.keep_habit_entry_id();
