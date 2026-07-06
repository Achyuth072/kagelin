-- =============================================================================
-- Rename habit_type value 'numerical' -> 'measurable'
-- =============================================================================
-- The original migration (20260616120000) shipped the enum value 'numerical',
-- which conflicts with the canonical glossary term "Measurable Habit"
-- (CONTEXT.md). This repair converts any already-applied data and swaps the
-- CHECK constraint to the corrected value set.
--
-- Idempotent: safe on a fresh DB (no 'numerical' rows; constraint is re-created
-- identically) and on a DB that already ran the original migration.
-- =============================================================================

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_habit_type_check;

UPDATE habits SET habit_type = 'measurable' WHERE habit_type = 'numerical';

ALTER TABLE habits
  ADD CONSTRAINT habits_habit_type_check
    CHECK (habit_type IN ('boolean', 'measurable'));
