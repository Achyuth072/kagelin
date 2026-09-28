-- frequency_days is the source of truth for N-in-D frequency (ADR 0019).
-- frequency_period is retained for transition and dropped later.

ALTER TABLE habits
  ADD COLUMN frequency_days integer
    CHECK (frequency_days BETWEEN 1 AND 365);

UPDATE habits
SET frequency_days = CASE frequency_period
  WHEN 'week' THEN 7
  WHEN 'month' THEN 30
  ELSE 1
END;

ALTER TABLE habits
  ALTER COLUMN frequency_period DROP NOT NULL;
