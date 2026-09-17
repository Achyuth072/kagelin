ALTER TABLE public.encryption_keys ADD COLUMN IF NOT EXISTS passphrase_reset_required BOOLEAN NOT NULL DEFAULT false;
