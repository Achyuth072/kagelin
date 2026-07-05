-- =============================================================================
-- BACKFILL TASK day_order (fix custom-sort reshuffle / DnD corruption)
-- =============================================================================
-- Every task historically defaulted to day_order = 0 on creation (column
-- DEFAULT and several insert call sites). Once some tasks were dragged to
-- unique values, any still-zero task sorted ahead of all of them in custom
-- sort, and the tie broke inconsistently between fetch paths — producing an
-- unexpected reshuffle that also corrupted the DnD reorder math (which
-- assumes day_order is strictly increasing across the visible list).
--
-- The create/recurring-task mutations now assign max(day_order) + 1 per user
-- instead of relying on the 0 default, so this is a one-time backfill.
-- Numbering is deterministic by created_at, per user, reproducing today's
-- effective order so users see no reshuffle on first load after deploy.
-- =============================================================================

UPDATE public.tasks AS t
SET day_order = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day_order, created_at DESC) - 1 AS rn
  FROM public.tasks
) AS ordered
WHERE t.id = ordered.id;
