# Kagelin — Domain Glossary

The canonical vocabulary for Kagelin. This file is a glossary, not a spec — it
defines what terms _mean_, never how they're implemented. When a term here
conflicts with how something is being described in a plan or PR, the conflict
must be resolved before proceeding.

---

## Sync (disambiguated)

"Sync" is overloaded and must always be qualified with one of the following.
These are three distinct features with very different server-compute costs.

### On-demand calendar sync

A calendar pull/push initiated **on the user's own device** (opening the
calendar, "Sync now", a debounced post-edit push, window refocus). The browser
talks **directly** to the provider (Google / Microsoft / CalDAV) using the
user's own access token and API quota. Kagelin's only server cost is an
occasional access-token refresh. Cheap. Available to **registered users** (free
tier included).

_Not to be confused with_ realtime cross-device mirroring or background
auto-sync.

### Realtime cross-device mirroring

Live propagation of state between a user's devices over Supabase Realtime
websocket channels (e.g. the focus timer in Phase 54, live remote-calendar
change push). Costs ongoing server compute that scales with connected devices.
A **paid / premium** capability.

### Background / scheduled auto-sync

Server-side synchronisation that runs **even when the user is not in the app**
(e.g. a cron keeping calendars fresh). Costs ongoing server compute that scales
with users. A **paid / premium** capability, deferred.

---

## Tiers

### Guest

An unregistered user. Data is local-only (with optional client-side WebDAV
backup). Has no server identity (`auth.uid()`). Can use **CalDAV** (credentials
held client-side) but **not** Google/Outlook OAuth, which structurally requires
a server-anchored identity.

### Registered (free)

A user with a Kagelin account (`auth.uid()`). Data persists to the cloud. Gets
**on-demand calendar sync** for all providers. Does **not** get realtime
cross-device mirroring, background auto-sync, or push.

### Premium (paid)

A registered user who pays. Adds realtime cross-device mirroring, background
auto-sync, and push notifications on top of the registered-free capabilities.

---

## Habits

### Habit

An intention the user tracks day-by-day. The umbrella term covering two kinds —
a Habit is always one or the other:

- **Boolean Habit** — done / not-done per day. The original and (for now) only
  kind with native tracking UX.
- **Measurable Habit** — each Entry carries a real quantity (pages read, km run)
  judged against a target. Schema and import only for now; no native entry UX yet.

A Habit also carries a **frequency** — how often it is meant to be done
(e.g. daily, or three times a week). "Three times a week" _is_ expressible.
_Avoid_: Goal, routine, task.

### Entry

The record of a Habit on a specific date. What counts as **done** depends on the
Habit kind:

- **Boolean Habit**: done iff `value: 1`. The absence of an Entry and `value: 0`
  both mean "not done."
- **Measurable Habit**: done iff the day **meets its target** — for an `at_least`
  target, the logged quantity ≥ target; for `at_most`, ≤ target. An absent day
  reads as quantity `0`.

### Entry state (done / not done / skipped / unknown)

The canonical vocabulary for a day's status, mirroring the source trackers we
import from:

- **Done** — the target was met (see Entry).
- **Not done** — explicitly missed.
- **Unknown** — never logged. Indistinguishable from "not done" in our model.
- **Skipped** — deliberately not counted (a rest day): does not break a Streak
  and is excluded from Score.

Our store records only two of these — an Entry exists (with a `value`) or it
doesn't. **Done** and **not done / unknown** map cleanly; **Skipped has no
representation yet** and is collapsed to "not done" on import. Consequence:
imported habits that used the source app's skip feature show a slightly lower
Score and shorter Streaks than the original. Fidelity guarantees (and the Score
verification tests) are therefore scoped to **skip-free** habits until native
tracking introduces a real skipped state.

### "Done"-counting vs strength metrics (Measurable Habits)

The "absent reads as `0`" rule above feeds **Score** only (a continuous strength
0..1). Day-counting metrics — Streak, Best Streak, total completions — count only
days with a logged Entry that meets target, and for now are shown for **Boolean
Habits only**. This prevents an `at_most` Measurable Habit (e.g. "≤ 1 coffee/day")
from reading as an unbroken streak across every unlogged day.

### Streak

The current unbroken run of done-days ending at the present. A **today that has
not been logged yet is _pending_, not a break** — the streak counts through
yesterday and only breaks when a day that has _already passed_ was missed. So a
30-day run still reads "30" all morning before today is logged.

**Frequency-aware**: for a non-daily Habit (e.g. 3× / week), a streak is _not_ a
run of consecutive calendar days the Habit was logged. The schedule first
**fills in** the days between reps that satisfy the frequency, and the run is
counted over those filled-in (computed) days — so flawless 3×/week adherence is
one long streak, not a break every off-day. A daily Habit fills in nothing, so
its streak is unchanged. (Mirrors the source tracker's interval interpolation.)
_Avoid_: Chain, run length.

### Best Streak

The longest such run in the Habit's whole history (the top few are surfaced).
Same frequency-aware, computed-day basis as Streak.

### Score

A Habit's **strength**: how consistently it has been kept, as a percentage. Unlike
a Streak (a binary run that resets to zero on a single miss), Score **decays and
recovers gradually**, is weighted toward recent days, and is normalized by the
Habit's frequency (so a 3×/week habit isn't penalized for its four off-days). A
Habit can hold a high Score with a Streak of zero — strong for months, missed
yesterday. The exact computation is ported faithfully from the source tracker so
an imported Habit shows the number the user remembers.
_Displayed as_: "Strength" is the source tracker's UI label for the same number;
**Score** is the canonical term here. _Avoid_: Streak (a different metric).

A Habit's `Frequency` rendered as week-to-date completion — "2 / 3 this week,"
shown as a ring. It is **not a Goal**: a Habit has no Goal, only a Frequency, and
this is just that Frequency drawn against the current period. _Avoid_: Goal.

Every Habit is implicitly **daily** (`1 / day`) — there is no "unset" state. The
progress ring is shown only when the target is **non-trivial** (more than once a
day, or a week/month period); a plain daily habit's "1 / 1" ring is redundant
next to the done/not-done toggle and is suppressed. The Frequency ring is shown
for **Boolean Habits only** (a Measurable `at_most` habit would read misleadingly
against a raw count), matching the day-counting-metric gate.

Frequency is authored as **times per day or week**; `month` is accepted in the
model for import fidelity but is not offered in the create/edit control (it stays
editable only on a Habit that already carries it). Frequency is **not
effective-dated**: it is a single current value, so editing it recomputes the
_entire_ Frequency grid and streak history against the new target — accepted as a
known tradeoff rather than snapshotting frequency per period.

---

## Goals

### Goal

A user-set target on a **global aggregate** — daily or weekly **focus-hours**, or
daily or weekly **tasks-completed**. Stored in preferences, set in Settings →
Goals, and shown as rings / bars on `/stats`. The word `Goal` names **only** these
global targets. There is **no per-item Goal**, no Goal attached to a Habit (a
Habit has a Frequency; see Frequency progress), and **no arbitrary-Goal entity** —
the four globals are the whole feature. _Avoid_: using "goal" for a Habit's
frequency or for any per-item target.

---

## Recurring tasks

### Recurrence

The rule on a task that makes it repeat ("every Monday"). A task either has a
Recurrence or it is one-off.

### Series

The durable identity tying together every dated instance of one recurring task
across time. The Series is what **survives a rename** — without it, occurrences
are related only incidentally (by matching content + project + date), so renaming
a task orphans its history. The Series is the fix for that.

### Occurrence

A single dated instance belonging to a Series. When a recurring task is completed,
the next Occurrence is spawned and carries the same Series identity.
_Avoid_: instance, spawn, **chain** (also banned for Streak).

---

## Analytics

### Stats

The **app-wide** analytics surface at `/stats`: everything aggregated across all
habits, tasks, and focus — period selector, breakdowns, time-of-day heatmap,
per-habit Score comparison. Global scope only.

### Insights

The **single-item** analytics surface, reached via the **Edit / Insights** toggle
inside one Habit's or one recurring Task's edit sheet. Scoped to exactly one item.
A Task has Insights only when it belongs to a Series. "Habit stats" is a misnomer —
that surface is **Habit Insights**; `Stats` always means the global page.
_Avoid_: "stats" for a per-item view.

### Backup vs Stats export

Two distinct things that both say "export":

- **Backup** — full portability: the complete dataset as a ZIP (JSON + ICS),
  round-trips with Import.
- **Stats export** — a read-only analytics extract (CSV daily rollup / JSON stats
  payload), scoped to the current period or one item's Insights. Not a backup;
  does not round-trip.

---

## Calendar connection

### Connect Calendar (vs. login identity)

The OAuth consent flow for _granting calendar access_ is **separate** from the
login/auth identity. A user logs into Kagelin via magic link; connecting a Google
or Outlook calendar is a distinct, additional consent with calendar scopes.

### Primary calendar / write target

Of the calendars discovered on a connected account, exactly one is the **write
target** — the calendar Kagelin-authored events are pushed to. It defaults to the
account's primary calendar. All other discovered calendars are read-only (pull)
display.

### Tombstone

A locally-deleted synced event that has not yet been removed from the remote
provider. It is retained (marked) only until the deletion is pushed remotely,
then hard-deleted locally.

### kansoId

Kagelin's own event `id` (UUID), stamped into the remote event at create time via
a provider-specific extended property (Google: `extendedProperties.private.kansoId`;
MS Graph: `singleValueExtendedProperties`). Returned on read so that a subsequent
pull can recognise a just-created event and adopt its `remote_id` / `etag` without
inserting a duplicate. Distinct from `remote_id` (the provider's own event
identifier) and from `id` (the local DB primary key, which happens to be the same
value).
