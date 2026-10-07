-- current_key_id advances on every rotation; retired_keys maps a retired key id to that key
-- wrapped under the current content key, and is emptied when the Re-seal completes.
ALTER TABLE public.encryption_keys
  ADD COLUMN IF NOT EXISTS current_key_id INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS retired_keys JSONB NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.reject_unmigrated_plaintext()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_migrated BOOLEAN;
  is_sealed_v2 BOOLEAN;
  current_key TEXT;
  col TEXT;
  val TEXT;
BEGIN
  SELECT migrated_at IS NOT NULL, sealed_v2_at IS NOT NULL, current_key_id::text
  INTO is_migrated, is_sealed_v2, current_key
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
    -- Same for a value still under a retired key while the Re-seal runs.
    IF val IS NOT NULL
       AND split_part(val, ':', 2) <> current_key
       AND NOT (TG_OP = 'UPDATE' AND val IS NOT DISTINCT FROM (to_jsonb(OLD) -> col) #>> '{}') THEN
      RAISE EXCEPTION 'Column %.% must be sealed with the current content key', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation', HINT = 'content_key_retired';
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
  current_key TEXT;
BEGIN
  IF NEW.notes IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT k.migrated_at IS NOT NULL, k.sealed_v2_at IS NOT NULL, k.current_key_id::text
  INTO is_migrated, is_sealed_v2, current_key
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
  ELSIF split_part(NEW.notes, ':', 2) <> current_key
        AND NOT (TG_OP = 'UPDATE' AND NEW.notes IS NOT DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Column habit_entries.notes must be sealed with the current content key'
      USING ERRCODE = 'check_violation', HINT = 'content_key_retired';
  END IF;

  RETURN NEW;
END;
$$;

-- Commits every new wrapper, the retired-key chain and the key id advance in one statement, or
-- none of them. Clearing sealed_v2_at makes the next unlock on any device resume the Re-seal.
CREATE OR REPLACE FUNCTION public.rotate_content_key(
  p_expected_key_id INTEGER,
  p_passphrase_salt TEXT,
  p_passphrase_kdf_params JSONB,
  p_wrapped_key_passphrase TEXT,
  p_recovery_salt TEXT,
  p_recovery_kdf_params JSONB,
  p_wrapped_key_recovery TEXT,
  p_retired_keys JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_key_id INTEGER;
BEGIN
  UPDATE public.encryption_keys
  SET passphrase_salt = p_passphrase_salt,
      passphrase_kdf_params = p_passphrase_kdf_params,
      wrapped_key_passphrase = p_wrapped_key_passphrase,
      recovery_salt = p_recovery_salt,
      recovery_kdf_params = p_recovery_kdf_params,
      wrapped_key_recovery = p_wrapped_key_recovery,
      retired_keys = p_retired_keys,
      current_key_id = current_key_id + 1,
      sealed_v2_at = NULL,
      passphrase_reset_required = false
  WHERE user_id = auth.uid()
    AND current_key_id = p_expected_key_id
  RETURNING current_key_id INTO new_key_id;

  IF new_key_id IS NULL THEN
    RAISE EXCEPTION 'The content key changed on another device. Unlock again and retry.'
      USING ERRCODE = 'check_violation', HINT = 'content_key_retired';
  END IF;

  RETURN new_key_id;
END;
$$;
