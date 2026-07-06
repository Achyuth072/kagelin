# Streaks are frequency-aware, computed over interpolated checkmarks

Phase 57 gives Habits a frequency schedule (e.g. 3× / week). A streak counted as
consecutive logged calendar days would then break on every off-day — flawless
3×/week adherence would read as a 1-day streak forever. To avoid that, a Habit's
done-days are first **interpolated from the schedule** (the source tracker's
interval algorithm: anchor on the rep completing the required count, extend over
the period, clamp to today, merge overlaps), and Streak / Best Streak are counted
over those computed days rather than the raw entries. A daily Habit interpolates
nothing, so its streak is unchanged.

We chose this over a simpler daily-only streak because faithful mirroring of the
imported tracker's numbers is a headline goal of the phase — the streak a user
remembers must match what they see. We rejected a homegrown "gap tolerance"
shortcut: it would be neither faithful nor clean and would carry its own
edge-case bugs.

## Consequences

- 57-02 ports **two** algorithms, not one: `Score.compute` _and_ the
  interval/checkmark interpolation. `getCurrentStreak` changes from operating on
  the raw done-set to operating on the interpolated done-set.
- Streak semantics are now harder to reverse — once users see frequency-aware
  numbers, reverting to daily-only would silently shrink everyone's streaks.
