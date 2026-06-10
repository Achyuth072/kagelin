-- calendar_oauth_tokens: stores encrypted refresh tokens for Google/Outlook OAuth (Phase 55)
-- RLS: service-role only — the client must never read refresh tokens
CREATE TABLE IF NOT EXISTS public.calendar_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  encrypted_refresh_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT calendar_oauth_tokens_user_provider_unique UNIQUE (user_id, provider)
);

CREATE TRIGGER calendar_oauth_tokens_updated_at
  BEFORE UPDATE ON public.calendar_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.calendar_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No client-facing policies — only service-role can read/write
-- Route handlers use the service-role key via createClient() on the server
