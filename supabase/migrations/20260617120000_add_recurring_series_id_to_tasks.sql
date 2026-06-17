-- Series identity for recurring tasks. Occurrences of one recurring task share
-- a recurring_series_id so history survives a rename. Same name as the calendar
-- metadata key; here it is a real column.
ALTER TABLE tasks ADD COLUMN recurring_series_id uuid;

-- Heuristic backfill: group existing recurring Series by (user_id, content,
-- project_id) where recurrence is set. Each Occurrence also carries the
-- recurrence rule, so this captures the whole Series (past + future).
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

-- Task Insights queries Occurrences by Series.
CREATE INDEX idx_tasks_recurring_series_id
  ON tasks (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;
