-- =============================================================================
-- Add measurable-habit columns (habit_type, frequency, target) to habits
-- =============================================================================
-- Extends the habit model beyond boolean-only. Existing rows get defaults so
-- no data is lost: every existing boolean habit becomes habit_type = 'boolean'
-- with frequency 1×/day and target_type = 'at_least' (all metadata — no score
-- change without a target_value).
--
-- frequency_count is nullable; NULL means "1" (the application-layer fallback
-- keeps boolean habits without explicit frequency behaving as daily).
-- target_value is nullable metadata; entry-time validation is deferred to the
-- native measurable tracking UI (Phase 58+).
--
-- No CHECK constraint on frequency_count > 0 (enforced at the application
-- layer via Zod); a DB-level constraint can be added later if data corruption
-- is observed.
-- =============================================================================

ALTER TABLE habits
  ADD COLUMN habit_type text NOT NULL DEFAULT 'boolean'
    CHECK (habit_type IN ('boolean', 'numerical')),
  ADD COLUMN frequency_count integer,
  ADD COLUMN frequency_period text DEFAULT 'day'
    CHECK (frequency_period IN ('day', 'week', 'month')),
  ADD COLUMN target_type text DEFAULT 'at_least'
    CHECK (target_type IN ('at_least', 'at_most')),
  ADD COLUMN target_value real,
  ADD COLUMN unit text;
