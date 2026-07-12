-- external_calendars: had lived only in supabase/schema.sql (never a tracked
-- migration), so `db push` could never provision it on a fresh/behind project —
-- exactly what left kagelin-prod without this table (#57). All statements are
-- idempotent so this is a safe no-op on any environment that already has it.

CREATE TABLE IF NOT EXISTS public.external_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  provider TEXT NOT NULL CHECK (provider IN ('caldav', 'google', 'outlook', 'icloud', 'fastmail', 'nextcloud')),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4B6CB7',

  server_url TEXT,
  calendar_url TEXT,
  principal_url TEXT,
  username TEXT,

  oauth_provider_token_id TEXT,
  remote_calendar_id TEXT,

  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,

  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'pull', 'push')),

  is_premium_provider BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT external_calendars_name_length CHECK (char_length(name) <= 100)
);

CREATE INDEX IF NOT EXISTS external_calendars_user_id_idx ON public.external_calendars (user_id);
CREATE INDEX IF NOT EXISTS external_calendars_provider_idx ON public.external_calendars (provider);

DROP TRIGGER IF EXISTS external_calendars_updated_at ON public.external_calendars;
CREATE TRIGGER external_calendars_updated_at
  BEFORE UPDATE ON public.external_calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own external_calendars" ON public.external_calendars;
CREATE POLICY "Users can view own external_calendars" ON public.external_calendars
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own external_calendars" ON public.external_calendars;
CREATE POLICY "Users can insert own external_calendars" ON public.external_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own external_calendars" ON public.external_calendars;
CREATE POLICY "Users can update own external_calendars" ON public.external_calendars
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own external_calendars" ON public.external_calendars;
CREATE POLICY "Users can delete own external_calendars" ON public.external_calendars
  FOR DELETE USING (auth.uid() = user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_remote_calendar_fk') THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_remote_calendar_fk
      FOREIGN KEY (remote_calendar_id) REFERENCES public.external_calendars(id) ON DELETE SET NULL;
  END IF;
END $$;
