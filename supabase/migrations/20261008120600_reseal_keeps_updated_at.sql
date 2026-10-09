-- A Re-seal rewrites only the ciphertext of unchanged text, so it keeps updated_at: a bump
-- would make a stale pending calendar edit win last-write-wins over a newer remote one.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NULLIF(current_setting('request.headers', true), '')::json->>'x-kagelin-reseal' = '1' THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
