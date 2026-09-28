---
status: accepted
supersedes: ADR 0005
---

# Frequency is N times in any D-day window, stored as `frequency_days`

A Habit's Frequency was stored as a count plus a `frequency_period` enum
(`day` / `week` / `month`), so uhabits' "every N days" schedules (`1/50`, `1/3`,
`2/7` with any denominator) could only be approximated on import
([ADR 0005](0005-uhabits-frequency-import-approximation.md)), and a user could
not author "every 50 days" at all. Streak, Score and interval interpolation
already evaluate over sliding windows of a day count; only the storage and the
Frequency ring were calendar- or enum-shaped.

We model Frequency as **N times in any D-day window** and store D as
`frequency_days`, the single source of truth. "Week" and "month" become authoring
presets for D = 7 and D = 30, not calendar periods. The Frequency ring switches
from calendar week/month-to-date to the same sliding window, so it can no longer
read 0 / 3 on a Monday while the Streak says the Habit is on track.

## Considered options

- **Keep `frequency_period` and add an optional `frequency_days` override
  permanently** — rejected: two sources of truth for one value drift, and every
  reader has to know the precedence rule forever.
- **Add a separate "interval" concept beside Frequency** — rejected: uhabits
  itself has one fraction, and the streak/score engine already treats every
  Frequency as a day-window fraction; a second concept would split one idea.

## Consequences

- `frequency_period` is kept only for a transition window: writers write both,
  readers use `frequency_days ?? period`, because stale cached PWAs, Guest
  `localStorage` and the persisted IndexedDB query cache can still hold or write
  period-only Habits. A later migration drops the column.
- uhabits import and export become lossless for frequency.
- The Frequency ring's meaning changes for existing weekly Habits ("this week" →
  "last 7 days").
