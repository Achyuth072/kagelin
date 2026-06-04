# Server-anchored deadline model for the focus timer

The cross-device focus timer stores an absolute deadline (`endsAt`, epoch ms)
instead of a `startedAt` + full-duration assumption, and derives `serverNow`
from a once-per-connect RTT-corrected probe of Postgres time
(`offset = serverNow − Date.now()`). Running state syncs `ends_at`; paused
state syncs `remaining_seconds`. A freshly-applied remote snapshot is **never**
reconciled against a local anchor.

We chose this because the old model recomputed remaining as
`fullDuration − (now − startedAt)`, which was false for partial/resumed timers
and, combined with an unconditional post-apply `reconcile()`, caused remote
snapshots to spuriously complete and auto-start timers across devices. An
absolute deadline plus a corrected clock gives sub-second cross-device
agreement even when device clocks are wrong, and lets a device opening
mid-session show the live countdown immediately.

## Consequences

- **Foreground-completes, others mirror.** The device the user is actually
  looking at (`document.visibilityState === "visible"`) fires completion at
  `endsAt` — logs the session, increments `completed_sessions`, auto-advances.
  Backgrounded/closed devices clamp to 00:00 and mirror the synced transition
  when they next return. So moving between your own devices never leaves a timer
  stuck at 00:00 waiting for an absent "owner" — whichever device you're on
  finishes it (this replaced the original owner-only model, which stalled the
  common single-user / multi-device hand-off).
- **Atomic completion claim.** When several foregrounded devices reach `endsAt`
  together, each issues a conditional `UPDATE … WHERE is_running AND ends_at =
<the deadline>`; Postgres serializes them so exactly one row-affecting write
  wins. The winner fires side-effects; losers get zero rows back, skip
  side-effects, and mirror via realtime — so a session is never double-logged.
- `source_device_id` is the realtime echo guard (a device skips its own
  changes); concurrent writes resolve by trigger-set `updated_at` (LWW).
- Realtime delivery relies on RLS to scope the per-user row (no non-PK
  `user_id` filter, which would need `REPLICA IDENTITY FULL`); the subscription
  mirrors the working tasks-changes pattern.
