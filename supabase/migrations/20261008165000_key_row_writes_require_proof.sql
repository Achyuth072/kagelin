-- The owner's UPDATE policy covers every column, so a session without the content key could
-- overwrite the wrappers, roll the key chain back or move a marker. Only the definer RPCs,
-- which demand proof of the key, change the row. A session may still backfill a missing
-- verifier, and flag a passphrase reset so the recovery-code unlock itself never needs the proof.
CREATE OR REPLACE FUNCTION public.guard_encryption_key_markers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       (to_jsonb(NEW) - 'rotation_verifier' - 'passphrase_reset_required' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'rotation_verifier' - 'passphrase_reset_required' - 'updated_at')
    OR (OLD.rotation_verifier IS NOT NULL AND NEW.rotation_verifier IS DISTINCT FROM OLD.rotation_verifier)
    OR (OLD.passphrase_reset_required AND NOT NEW.passphrase_reset_required)
  ) THEN
    RAISE EXCEPTION 'Only a device holding the content key can change the key row'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- Returns no row when the key id moved on, so a stale device learns it must unlock again.
-- Retired keys can only be cleared here; only a rotation adds them.
CREATE OR REPLACE FUNCTION public.update_encryption_key_row(
  p_expected_key_id INTEGER,
  p_rotation_token TEXT,
  p_patch JSONB
)
RETURNS SETOF public.encryption_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stored_key_id INTEGER;
  stored_verifier TEXT;
  proof TEXT := encode(sha256(decode(p_rotation_token, 'base64')), 'base64');
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_patch) AS k
    WHERE k NOT IN (
      'passphrase_salt', 'passphrase_kdf_params', 'wrapped_key_passphrase',
      'recovery_salt', 'recovery_kdf_params', 'wrapped_key_recovery',
      'passphrase_reset_required', 'migrated_at', 'sealed_v2_at', 'retired_keys'
    )
  ) OR (p_patch ? 'retired_keys' AND p_patch -> 'retired_keys' <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'Only a rotation changes the content key chain'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT current_key_id, rotation_verifier INTO stored_key_id, stored_verifier
  FROM public.encryption_keys
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF stored_key_id IS DISTINCT FROM p_expected_key_id THEN
    RETURN;
  END IF;

  -- A missing verifier is backfilled by a direct UPDATE first, so trust on first use has one path.
  IF stored_verifier IS NULL OR stored_verifier IS DISTINCT FROM proof THEN
    RAISE EXCEPTION 'This device could not prove it holds your content key. Contact support.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- COALESCE keeps a marker that is absent or null in the patch, so neither can be cleared.
  RETURN QUERY
  UPDATE public.encryption_keys
  SET passphrase_salt = COALESCE(p_patch ->> 'passphrase_salt', passphrase_salt),
      passphrase_kdf_params = COALESCE(NULLIF(p_patch -> 'passphrase_kdf_params', 'null'::jsonb), passphrase_kdf_params),
      wrapped_key_passphrase = COALESCE(p_patch ->> 'wrapped_key_passphrase', wrapped_key_passphrase),
      recovery_salt = COALESCE(p_patch ->> 'recovery_salt', recovery_salt),
      recovery_kdf_params = COALESCE(NULLIF(p_patch -> 'recovery_kdf_params', 'null'::jsonb), recovery_kdf_params),
      wrapped_key_recovery = COALESCE(p_patch ->> 'wrapped_key_recovery', wrapped_key_recovery),
      passphrase_reset_required = COALESCE((p_patch ->> 'passphrase_reset_required')::BOOLEAN, passphrase_reset_required),
      migrated_at = COALESCE((p_patch ->> 'migrated_at')::TIMESTAMPTZ, migrated_at),
      sealed_v2_at = COALESCE((p_patch ->> 'sealed_v2_at')::TIMESTAMPTZ, sealed_v2_at),
      retired_keys = CASE WHEN p_patch ? 'retired_keys' THEN '{}'::jsonb ELSE retired_keys END
  WHERE user_id = auth.uid()
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_encryption_key_row(INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_encryption_key_row(INTEGER, TEXT, JSONB) TO authenticated;
