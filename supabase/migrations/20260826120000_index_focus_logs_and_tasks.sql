-- =============================================================================
-- focus_logs and tasks were the only RLS-scoped, frequently-read tables with no
-- index beyond their primary key, so every stats/heatmap/list query seq-scanned
-- the table and then filtered by user_id. That got more expensive once those
-- reads started paging the full row set instead of stopping at PostgREST's
-- silent 1000-row cap.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Supabase runs each migration inside a
-- transaction, where CONCURRENTLY is not permitted. It takes a SHARE lock —
-- reads keep working, writes wait — which is acceptable at current table sizes.
-- =============================================================================

-- Every focus_logs read filters by user_id and then filters/orders on
-- start_time, so the composite serves both; its leftmost prefix covers
-- user_id-only lookups, making a separate user_id index redundant.
CREATE INDEX IF NOT EXISTS focus_logs_user_id_start_time_idx
  ON public.focus_logs (user_id, start_time);

-- tasks is the most-queried table in the app (task list, subtasks, series,
-- stats). Starting with user_id alone: useTasks also filters on parent_id and
-- orders on day_order, but a composite there should be justified by
-- EXPLAIN ANALYZE against real volume rather than guessed at.
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks (user_id);
