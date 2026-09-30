CREATE OR REPLACE FUNCTION public.record_habit_entry(
  p_habit_id UUID,
  p_date DATE,
  p_state TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_habit_type TEXT;
BEGIN
  IF p_state NOT IN ('done', 'skipped') THEN
    RAISE EXCEPTION 'invalid state: %', p_state;
  END IF;

  SELECT habit_type INTO v_habit_type FROM public.habits WHERE id = p_habit_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF p_state = 'done' AND v_habit_type = 'measurable' THEN
    RETURN 'measurable';
  END IF;

  -- Preserves existing notes on conflict.
  INSERT INTO public.habit_entries (habit_id, date, value)
  VALUES (p_habit_id, p_date, CASE p_state WHEN 'done' THEN 1 ELSE -2 END)
  ON CONFLICT (habit_id, date) DO UPDATE SET value = EXCLUDED.value;

  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_habit_entry(UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_habit_entry(UUID, DATE, TEXT) TO authenticated;
