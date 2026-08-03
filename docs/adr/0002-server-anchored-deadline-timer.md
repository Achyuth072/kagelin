# Server-anchored deadline model for the focus timer

The timer stores an absolute deadline (`endsAt`, epoch ms) instead of
`startedAt + duration`. On connect, we measure server time with an RTT-corrected
Postgres probe (`offset = serverNow − Date.now()`), then derive all countdowns
from that offset. Running state syncs `ends_at`; paused state syncs `remaining_seconds`.

The old model recomputed remaining as `fullDuration − (now − startedAt)`, which
broke on pause/resume and caused remote snapshots to spuriously complete timers.
An absolute deadline fixes this: each device computes the same countdown from a
common reference, gives sub-second agreement even with wrong device clocks, and
lets a device joining mid-session show live countdown immediately.

## Consequences

- **Completion fires on whichever device is foregrounded.** When `now ≥ endsAt`,
  the visible device logs the session and advances it; backgrounded devices clamp
  to 00:00 and mirror the next sync. Prevents timers stuck at 00:00 waiting for
  an absent "owner" device when the user switches devices mid-session.
- **Race-free completion.** Concurrent devices both reaching `endsAt` issue
  `UPDATE … WHERE is_running AND ends_at = <deadline>`. Postgres serializes to
  one row-affecting write. Winner fires side-effects; losers skip them and mirror
  via realtime — no double-logging, no split-brain.
- **Realtime sync.** `source_device_id` prevents echo (device skips its own
  writes). Concurrent conflicts resolve by trigger-set `updated_at` (last-write-wins).
  Subscription scoped by RLS on `user_id` (mirrors the working tasks-changes pattern).

## Amendment: server-derived notification scheduling

Notification _scheduling_ moved server-side (`handle_timer_notification_sync`,
a trigger on `user_timer_state`), replacing the client-driven `/api/timer/start`
path. On every write, the trigger cancels the user's pending `timer_end` rows
and re-projects the chain of upcoming deadlines from the row's own `ends_at`,
`mode`, and `completed_sessions`, replaying the same mode-transition state
machine `timerStore`'s `completeTimer()` runs client-side. This was driven by
four defects traced to scheduling being a client-authored, per-device artifact
with no relationship to the timer's actual deadline: cross-device duplicate
rows, duration-based scheduling drift, a chain that stalled when no device was
foregrounded, and cancellation that only reached the row a given device itself
created. See `.planning/65-PUSH-DELIVERY-DIAGNOSIS.md` and
`.planning/67-PUSH-DELIVERY-QUEUE-CHAIN-SPEC.md`.

**This does not change completion semantics.** The consequences above —
foreground-device completion, the race-free `WHERE is_running AND ends_at =
<deadline>` claim — are exactly as documented and untouched. The split is
deliberate: _scheduling_ (when a `timer_end` push is queued) is now derived
server-side from state; _completion_ (which device logs and advances a
finished session) is still decided locally, by whichever device is
foregrounded when the deadline arrives. Read this ADR's "Consequences" section
above as still authoritative for completion; only scheduling moved.
