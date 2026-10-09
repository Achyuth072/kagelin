-- Accept the row-bound -v2 envelope scheme wherever the server recognises sealed values.
-- Nothing seals -v2 yet; this lets readers and backstops tolerate it before the writers ship.

CREATE OR REPLACE FUNCTION public.encrypted_notification_body(
  template TEXT,
  ciphertext TEXT
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN ciphertext ~ '^xchacha20poly1305-v[12]:'
    THEN jsonb_build_object('template', template, 'ciphertext', ciphertext)
  END;
$$;

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
    IF val IS NOT NULL AND val !~ '^xchacha20poly1305-v[12]:' THEN
      RAISE EXCEPTION 'Column %.% must be encrypted once a user has completed content-key setup', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation';
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
BEGIN
  IF NEW.notes IS NULL OR NEW.notes ~ '^xchacha20poly1305-v[12]:' THEN
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
