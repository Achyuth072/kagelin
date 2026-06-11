-- =============================================================================
-- HABIT REORDERING (56-02)
-- =============================================================================
-- Add a durable user-defined order to habits. `sort_order` is the single source
-- of truth for both the compact (drag-to-reorder) and grid (static) views.
--
-- Backfill is deterministic: existing rows are numbered per-user by created_at,
-- reproducing today's visible order exactly so users see no reshuffle on first
-- load after deploy. NOT NULL DEFAULT 0 keeps new rows safe before the create
-- mutation's max+1 runs.
-- =============================================================================

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE public.habits AS h
SET sort_order = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS rn
  FROM public.habits
) AS ordered
WHERE h.id = ordered.id;

CREATE INDEX IF NOT EXISTS habits_user_sort_idx ON public.habits (user_id, sort_order);
