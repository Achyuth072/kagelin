# Reminders are skipped when their local time does not exist that day

Producers that fire on a local wall-clock time — `enqueue_due_habit_reminders`
today, and any per-minute producer added later — compare a naive local
timestamp (`now() AT TIME ZONE p.timezone`) against the user's configured time.
On the day a timezone springs forward, an hour of local wall-clock time never
occurs, so a reminder set inside it has no minute to match.

In `America/New_York` on 2026-03-08 the clock goes 01:59 → 03:00. A 02:30
reminder is silently dropped. Zones that shift at midnight — Chile, Cuba,
Lebanon, Paraguay — put that dead hour at 00:00–00:59, which is a far more
plausible reminder time than 02:30. Zones with a half-hour shift, such as Lord
Howe Island, narrow the window to 30 minutes but behave the same way.

## Considered options

- **Fire at the first valid local minute** (03:00 in New York) — rejected: it
  needs explicit gap detection, awkward to express set-at-a-time, and every
  reminder in the dead hour then arrives at once, at a time nobody asked for.
- **Compare instants and let Postgres resolve the time** — rejected: Postgres
  maps `2026-03-08 02:30` in `America/New_York` to `07:30Z`, which reads back as
  local **03:30**, an hour _past_ the gap. That contradicts the 10-minute
  lookback rule below, and it would also move the fall-back case from the first
  occurrence of the repeated hour to the second.

## Decision

A reminder fires only if it can be delivered within 10 minutes of its requested
local time. Otherwise it does not fire at all. This is the same rule the
10-minute lookback already states — a reminder delivered long after the moment
it names is noise — applied to a minute that never happened.

Two consequences follow, and both are intended:

- Reminders in the **last ~10 minutes** of the dead hour still fire, at the
  instant the clock jumps. This is not a second rule; it is the delivery window
  landing where it always does.
- **Falling back** needs no special handling. The repeated hour would match
  twice, but the producer's 20-hour per-reference guard suppresses the second,
  so the reminder fires once, on the first occurrence.

The daily and evening briefing helpers match a one-hour local window
(`08:00 ≤ local < 09:00`) rather than a minute, so a one-hour gap cannot erase
them, and the same 20-hour guard covers their repeated hour. They need no
change; this rule is stated for all local-time producers so the next one written
does not have to rediscover it.

No automated test pins this. The repository has no database test harness — no
`supabase/config.toml`, no pgTAP — and standing one up is a larger piece of work
than the behaviour it would cover, so it is tracked separately. Until then this
ADR is the only guard, and a change to the producer's time arithmetic should be
checked against it by hand.
