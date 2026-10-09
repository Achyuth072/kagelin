-- The Re-seal rewrites raw and file_name in place under the current scheme and key; without
-- this the update matches no row and the upgrade never finishes for an Account with an import.
DROP POLICY IF EXISTS "Users can update own habit_imports" ON public.habit_imports;
CREATE POLICY "Users can update own habit_imports" ON public.habit_imports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
