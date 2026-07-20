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

## Amendment (2026-07-20): current-streak liveness + known interpolation gap

`getCurrentStreak` gated the run on reaching today (with a 1-day "pending today"
grace). For a frequency Habit whose current period isn't met yet, the interpolated
run legitimately ends a day or two before today, so the gate zeroed the streak —
until the user logged today, at which point it snapped to the full run. This
surfaced right after uhabits import (habits with older history), reading as "the
streak only appears after I mark the habit complete."

uhabits' `StreakList.recompute` has **no reach-today gate** — it reports the most
recent run at full length regardless of when it ended. We matched that within a
bounded **pending window**: the streak is the run ending at the most recent
done-day found within that window of today. To keep Kagelin's inline "N streak"
reading as _currently ongoing_ (uhabits shows streaks in a historical chart
instead), the window is one frequency period, after which the streak lapses to 0 —
the one **deliberate deviation** from uhabits, which would report it forever. This
is display-only: export writes raw entries, which uhabits recomputes, so
round-trip fidelity is unaffected. Daily habits keep the exact 1-day window, and
Measurable habits keep it too (they interpolate nothing, so a longer window would
credit days never logged).

**Known gap (tracked, not yet fixed):** Kagelin's `interpolateDoneDays` does not
port uhabits' `snapIntervalsTogether` backward slide, nor its unclamped intervals.
As a result Kagelin's streak numbers run ~1–2 short of uhabits (e.g. 27 vs 28,
11 vs 13 on the fixtures in `uhabitsStreakParity.test.ts`). This is acceptable for
the display bug fixed here, but **true import/export round-trip parity requires
porting the faithful interpolation.** A validated uhabits oracle
(`tests/unit/support/uhabitsReference.ts`, checked against uhabits' own
`testComputeBoolean` fixture) and a differential suite are in place as the golden
target for that follow-up.
