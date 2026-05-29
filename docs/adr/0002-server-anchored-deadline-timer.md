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

- **Owner-completes, others mirror.** The running row's `source_device_id`
  marks the owner (last explicit writer); only the owner fires completion
  side-effects (log session, increment `completed_sessions`, auto-advance).
  Non-owners clamp to 00:00 and wait for the synced transition.
- **Accepted gap:** if the owner is offline at `endsAt`, other devices sit at
  00:00 until the owner next foregrounds (its visibility-resume reconcile then
  flushes completion) or any device taps to seize ownership. A grace-period
  auto-claim fallback is deferred.
- `source_device_id` replaces the racy 500 ms echo window; concurrent writes
  resolve by trigger-set `updated_at` (LWW).
