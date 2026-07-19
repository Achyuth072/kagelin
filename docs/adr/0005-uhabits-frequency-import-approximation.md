# uhabits frequency import approximates inexpressible schedules

uhabits stores no streak — both it and Kagelin recompute streaks at runtime from
raw entries plus a frequency schedule (uhabits dropped its `Streak`/`Score`
tables in migration 20). So importing a uhabits `.db` never "converts a streak";
it must carry each habit's **frequency** so Kagelin's interpolation
([ADR 0004](0004-frequency-aware-streaks-via-interpolated-checkmarks.md))
recomputes the same run. The importer previously dropped that frequency, silently
treating every imported habit as daily — understating Streak and Score for any
non-daily habit, contradicting the fidelity goal of ADR 0004.

uhabits expresses frequency as an arbitrary fraction `freq_num / freq_den` (reps
per days). Kagelin's schema expresses only three periods — `day` (1), `week` (7),
`month` (30). Clean cases map exactly (`den 1→day`, `7→week`, `30/31→month`,
`count = freq_num`) and round-trip losslessly. But uhabits' "every N days" preset
stores `(1, N)`, and `(1, 3)` has **no exact expression** in a day/week/month
enum.

We **approximate** inexpressible fractions to the nearest expressible period
(half-up, targeting `week` for small N), because the lossiness lives in Kagelin's
schema, not the mapping — no import choice makes "every 3 days" exact. Given that,
approximation drifts less than the alternative on both axes that matter: it keeps
a frequency-aware (non-daily) streak instead of a broken daily one, and a future
round-trip export emits `2/7` rather than null-collapsed `1/1`. We rejected
**exact-only-else-null** (leaves "every N days" habits showing the very broken
streak we set out to fix) and rejected **extending the schema with a raw
frequency passthrough** now (the genuinely lossless fix, but a data-model change
out of scope for a streak fix).

Scope is deliberately narrow: frequency only, on boolean habits. Day-counting
metrics (Streak, Best Streak, completions) render for boolean habits only, so
frequency is the _only_ input a displayed streak needs. `habit_type`, targets,
numerical-quantity entries, and SKIP state stay unmapped — imported exactly as
before, no regression — and are deferred to their own tickets.

## Consequences

- Exact frequencies (`X/day`, `X/week`, `X/month`) round-trip losslessly; only
  genuinely inexpressible schedules drift, and minimally. A later round-trip
  export inherits this — it cannot recover an original `1/3` from a stored `2/7`.
- Lossless round-trip requires a raw-frequency passthrough column: a separate,
  deliberate schema decision that supersedes this approximation if taken.
- Fixing frequency restores **Score** fidelity too — `computeScores` shares the
  identical `frequency_count`/`frequency_period` dependency.
- Numerical/measurable habits still import as pseudo-boolean with sparse entries
  (unchanged, pre-existing). Not a regression, but not faithful either — tracked
  separately.
- The importer's UTC date derivation is confirmed correct, not merely assumed:
  uhabits stores `Repetitions.timestamp` UTC-midnight-aligned
  (`DateUtils.getStartOfDay` truncates onto the epoch-day grid after
  `removeTimezone`), so `new Date(ms).toISOString()` recovers the exact logged
  day. No timezone handling is needed at import.
