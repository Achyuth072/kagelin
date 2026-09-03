ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS reminder_time TEXT,
  ADD COLUMN IF NOT EXISTS reminder_days INT NOT NULL DEFAULT 127;

ALTER TABLE public.habit_entries
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- REAL (not NUMERIC) avoids PostgREST serializing NUMERIC as a string.
ALTER TABLE public.habit_entries
  ALTER COLUMN value TYPE REAL;
