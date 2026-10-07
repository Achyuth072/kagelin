-- Per-Account marker for a finished Re-seal. Once set, the server rejects new `-v1` values.
ALTER TABLE public.encryption_keys ADD COLUMN IF NOT EXISTS sealed_v2_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reject_unmigrated_plaintext()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_migrated BOOLEAN;
  is_sealed_v2 BOOLEAN;
  col TEXT;
  val TEXT;
BEGIN
  SELECT migrated_at IS NOT NULL, sealed_v2_at IS NOT NULL
  INTO is_migrated, is_sealed_v2
  FROM public.encryption_keys
  WHERE user_id = NEW.user_id;

  IF NOT COALESCE(is_migrated, FALSE) THEN
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY TG_ARGV LOOP
    val := (to_jsonb(NEW) -> col) #>> '{}';
    IF val IS NOT NULL AND val !~ '^xchacha20poly1305-v[12]:' THEN
      RAISE EXCEPTION 'Column %.% must be encrypted once a user has completed content-key setup', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation';
    END IF;
    -- An untouched legacy value must not block edits to the row's other columns.
    IF COALESCE(is_sealed_v2, FALSE)
       AND val ~ '^xchacha20poly1305-v1:'
       AND NOT (TG_OP = 'UPDATE' AND val IS NOT DISTINCT FROM (to_jsonb(OLD) -> col) #>> '{}') THEN
      RAISE EXCEPTION 'Column %.% must be sealed with the current scheme', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation', HINT = 'sealing_scheme_outdated';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_unmigrated_plaintext_habit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_migrated BOOLEAN;
  is_sealed_v2 BOOLEAN;
BEGIN
  IF NEW.notes IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT k.migrated_at IS NOT NULL, k.sealed_v2_at IS NOT NULL
  INTO is_migrated, is_sealed_v2
  FROM public.habits h
  JOIN public.encryption_keys k ON k.user_id = h.user_id
  WHERE h.id = NEW.habit_id;

  IF NEW.notes !~ '^xchacha20poly1305-v[12]:' THEN
    IF COALESCE(is_migrated, FALSE) THEN
      RAISE EXCEPTION 'Column habit_entries.notes must be encrypted once a user has completed content-key setup'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF COALESCE(is_sealed_v2, FALSE)
        AND NEW.notes ~ '^xchacha20poly1305-v1:'
        AND NOT (TG_OP = 'UPDATE' AND NEW.notes IS NOT DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Column habit_entries.notes must be sealed with the current scheme'
      USING ERRCODE = 'check_violation', HINT = 'sealing_scheme_outdated';
  END IF;

  RETURN NEW;
END;
$$;
