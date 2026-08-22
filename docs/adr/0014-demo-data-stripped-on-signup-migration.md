# Demo data is stripped on signup migration, and demo-ness is permanent

A Guest arrives with Demo data already populated, and signup migrates the whole
guest store to the cloud — so a Guest who tours the app and registers currently
inherits fabricated habit history as their real streaks, scores and stats. We
strip Demo items during migration instead, and we treat demo-ness as permanent:
an edited Demo item is still a Demo item and is still stripped.

## Considered options

**Graduating edited items.** A Demo task renamed and rescheduled looks like the
Guest adopted it, so it could survive migration. Rejected: there is no signal
that separates "adapted this into a real task" from "poked it to see what
happens", and guessing wrong deletes real work. Permanence is the only rule
statable in one sentence at the moment the user needs to hear it — _"demo
content wasn't carried over"_ — which makes the outcome predictable even when it
is not the one a given user wanted.

**Asking at migration time.** Rejected: nobody wants a fabricated eight-week
history attributed to them, so the prompt has one sensible answer and only adds
a decision to a flow that should be celebratory. A Guest who wants to keep
something retypes it.

**Demo-only removal for the Guest-facing "Start fresh" too.** Rejected in favour
of a full clear. Demo projects are stripped only when empty after their tasks
go, so a partial clear can leave a Demo project holding the Guest's real work —
and then its demo-ness has to be re-adjudicated, with no right answer. A full
clear has no surviving state to adjudicate.

## Consequences

- Migration and "Start fresh" run **different rules** — migration strips
  selectively, "Start fresh" wipes everything. This is deliberate: an explicit
  destructive action is a different act from an automatic carry-over.
- The strip must **cascade by reference**, not by id list alone: habit entries
  follow their `habit_id`, focus logs follow their `task_id`. A seeded focus log
  that outlives its task becomes hours of work the user never did, showing up in
  their real stats.
- `seed_ids` has to cover projects and events, not just tasks and habits. This
  also closes the telemetry gap left by the exemption added in c4d75d1, where
  interactions with Demo projects and Demo events were still tracked as real
  engagement.
- The `> 1 project` heuristic that guarded against merging a guest blob into an
  established account gets weaker on its own: Demo projects are exactly what
  used to push that count past one, so a stripped tour contributes none.
  Replaced with a check across projects, tasks and habits together — a
  signup-fresh account holds none of the three, but a manually-created project
  alone (no tasks or habits yet) still counts as established, same as before.
- Guest-created calendar events are lost on signup regardless — migration has
  never inserted into `events`. Pre-existing, unrelated to this decision, and
  not addressed here.
