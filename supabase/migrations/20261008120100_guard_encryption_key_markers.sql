-- The owner's UPDATE policy covers every column, so without this a session could roll
-- current_key_id back or clear a marker and reopen writes the backstop rejects. Only
-- rotate_content_key, running as its owner, may move the key chain.
CREATE OR REPLACE FUNCTION public.guard_encryption_key_markers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.current_key_id IS DISTINCT FROM OLD.current_key_id
    OR (NEW.retired_keys IS DISTINCT FROM OLD.retired_keys AND NEW.retired_keys <> '{}'::jsonb)
    OR (OLD.migrated_at IS NOT NULL AND NEW.migrated_at IS NULL)
    OR (OLD.sealed_v2_at IS NOT NULL AND NEW.sealed_v2_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'The content key chain changes only through a rotation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encryption_keys_guard_markers ON public.encryption_keys;
CREATE TRIGGER encryption_keys_guard_markers
  BEFORE UPDATE ON public.encryption_keys
  FOR EACH ROW EXECUTE FUNCTION public.guard_encryption_key_markers();

-- Leaves sealed_v2_at alone: the retired keys alone mark the Re-seal as due, so the
-- -v1 rejection stays on through a rotation.
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
SECURITY DEFINER
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB) TO authenticated;
