# Rolling 3-Day/4-Day view stays today-anchored even though it diverges from Week

The rolling `3day`/`4day` views and Week's Day window both show "N days at a
time," but anchor differently: the rolling view starts at `currentDate` and
pages by its own day count, crossing week boundaries freely; Week's Day
window only scrolls within the current Sunday–Saturday Week and clamps at
its edges (see `CONTEXT.md`, "Day window"). Near the end of a week this means
the two show different dates for the same day count — e.g. on a Saturday, a
3-day rolling view shows Sat/Sun/Mon while Week's window clamps to
Thu/Fri/Sat.

## Considered options

- **Clamp the rolling view to Week boundaries too** — rejected: it would
  just become Week, losing the "look across a week boundary" behavior it
  exists for.
- **Let Week's Day window scroll past its edges instead of clamping** —
  already rejected once, in the change that reintroduced mobile Week view
  (issue #24): it "loses 'week' as a unit."

## Decision

Keep both anchoring models as-is. The two views deliberately show different
dates near week boundaries; this is not a bug to reconcile.
