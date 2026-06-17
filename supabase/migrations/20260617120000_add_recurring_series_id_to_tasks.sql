-- Series identity for recurring tasks. Occurrences of one recurring task share
-- a recurring_series_id so history survives a rename. Same name as the calendar
-- metadata key (Phase 55); here it is a real column.
ALTER TABLE tasks ADD COLUMN recurring_series_id uuid;

-- Heuristic backfill: group existing recurring chains by (user_id, content,
-- project_id) where recurrence is set. Spawned occurrences also carry the
-- recurrence rule, so this captures the whole chain (past + future).
WITH series AS (
  SELECT user_id, content, project_id, gen_random_uuid() AS sid
  FROM tasks
  WHERE recurrence IS NOT NULL
  GROUP BY user_id, content, project_id
)
UPDATE tasks t
SET recurring_series_id = s.sid
FROM series s
WHERE t.user_id = s.user_id
  AND t.content = s.content
  AND t.project_id IS NOT DISTINCT FROM s.project_id   -- NULL-safe on inbox tasks
  AND t.recurrence IS NOT NULL;

-- Insights (57-06) queries occurrences by series.
CREATE INDEX idx_tasks_recurring_series_id
  ON tasks (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;
