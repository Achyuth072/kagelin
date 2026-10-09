-- Require proof of the current content key to rotate it.
ALTER TABLE public.encryption_keys ADD COLUMN IF NOT EXISTS rotation_verifier TEXT;

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
    -- Set once by a device holding the key; after that only a rotation replaces it.
    OR (OLD.rotation_verifier IS NOT NULL AND NEW.rotation_verifier IS DISTINCT FROM OLD.rotation_verifier)
  ) THEN
    RAISE EXCEPTION 'The content key chain changes only through a rotation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rotate_content_key(
  p_expected_key_id INTEGER,
  p_passphrase_salt TEXT,
  p_passphrase_kdf_params JSONB,
  p_wrapped_key_passphrase TEXT,
  p_recovery_salt TEXT,
  p_recovery_kdf_params JSONB,
  p_wrapped_key_recovery TEXT,
  p_retired_keys JSONB,
  p_rotation_token TEXT,
  p_rotation_verifier TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stored_verifier TEXT;
  new_key_id INTEGER;
BEGIN
  SELECT rotation_verifier INTO stored_verifier
  FROM public.encryption_keys
  WHERE user_id = auth.uid();

  IF stored_verifier IS NULL
     OR stored_verifier IS DISTINCT FROM encode(sha256(decode(p_rotation_token, 'base64')), 'base64') THEN
    RAISE EXCEPTION 'Only a device holding the current content key can rotate it.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.encryption_keys
  SET passphrase_salt = p_passphrase_salt,
      passphrase_kdf_params = p_passphrase_kdf_params,
      wrapped_key_passphrase = p_wrapped_key_passphrase,
      recovery_salt = p_recovery_salt,
      recovery_kdf_params = p_recovery_kdf_params,
      wrapped_key_recovery = p_wrapped_key_recovery,
      retired_keys = p_retired_keys,
      rotation_verifier = p_rotation_verifier,
      current_key_id = current_key_id + 1,
      passphrase_reset_required = false
  WHERE user_id = auth.uid()
    AND current_key_id = p_expected_key_id
    AND rotation_verifier = stored_verifier
  RETURNING current_key_id INTO new_key_id;

  IF new_key_id IS NULL THEN
    RAISE EXCEPTION 'The content key changed on another device. Unlock again and retry.'
      USING ERRCODE = 'check_violation', HINT = 'content_key_retired';
  END IF;

  RETURN new_key_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, TEXT) TO authenticated;
