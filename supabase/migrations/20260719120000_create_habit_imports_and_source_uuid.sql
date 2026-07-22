-- Round-trip import provenance: habit_imports (raw, write-once) + habits.source_uuid.
-- Capture-only baseline; export writer deferred. See ADR 0006.
-- Idempotent — safe no-op where already applied.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS source_uuid TEXT;

CREATE TABLE IF NOT EXISTS public.habit_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_app TEXT NOT NULL DEFAULT 'uhabits',
  file_name TEXT,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS habit_imports_user_id_idx ON public.habit_imports (user_id);

ALTER TABLE public.habit_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own habit_imports" ON public.habit_imports;
CREATE POLICY "Users can view own habit_imports" ON public.habit_imports
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own habit_imports" ON public.habit_imports;
CREATE POLICY "Users can insert own habit_imports" ON public.habit_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own habit_imports" ON public.habit_imports;
CREATE POLICY "Users can delete own habit_imports" ON public.habit_imports
  FOR DELETE USING (auth.uid() = user_id);
