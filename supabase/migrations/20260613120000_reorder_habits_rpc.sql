-- =============================================================================
-- reorder_habits(updates jsonb) — atomic habit reorder
-- =============================================================================
-- Reorder previously issued one UPDATE per habit from the client; a mid-flight
-- failure left the DB holding a mix of new/old sort_orders that disagreed with
-- the snapped-back UI and persisted across reloads. A single UPDATE ... FROM
-- inside one function call commits all rows or none.
--
-- SECURITY INVOKER (default) so the habits RLS policy still scopes the write to
-- the caller's own rows. `updates` is a JSON array of {id, sort_order}.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reorder_habits(updates jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.habits AS h
  SET sort_order = (u.value ->> 'sort_order')::int
  FROM jsonb_array_elements(updates) AS u
  WHERE h.id = (u.value ->> 'id')::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_habits(jsonb) TO authenticated;
