# Board view works on mobile

Board was gated to desktop in three places: the view-switcher tab, the render
branch in `TaskList`, and the `shift+2` hotkey. Nothing recorded why, and the
board's own code argued against it — columns were sized `w-[85vw]` with
`snap-center`, a `TouchSensor` was configured, and `BoardTaskCard` branched on
`isDesktop` purely to keep its focus-timer button visible on touch. Three touch
accommodations for a view touch users couldn't open. We read that as an
unfinished rollout, not a constraint, and removed the gates.

That exposed two things that had never run at a narrow viewport.

## Decision

**Columns get `shrink-0`.** As flex children they were shrinking to fit rather
than overflowing. At 360px, `scrollWidth` equalled `clientWidth` — the board
could not scroll at all, so the snap carousel did nothing and dnd-kit's edge
auto-scroll had nothing to drive. With `shrink-0`, `scrollWidth` is 668px and a
cross-column drag scrolls 0 → 308. Desktop was latently affected too: enough
columns to overflow would have squeezed there as well.

**Both fallback columns always render.** Under `groupBy: "none"` they were
filtered by `tasks.length > 0`. But an empty "This Evening" is the drop target
that defers a task to tonight — `task-dnd.ts` maps the column title to
`is_evening` — so the filter removed the affordance exactly when it was most
useful, and left a phone showing one lone column. `KanbanColumn` already had an
empty state ("Ma (Void)") this path could never reach.

**Scroll-snap is suspended during a drag.** Snap re-adjusts the scroll offset
after programmatic scrolling ([MDN][mdn], [dnd-kit#825][dndkit]); setting
`scrollLeft = 100` with snap active snaps it back to 0. The documented fix is to
toggle `scroll-snap-type` off for the duration.

Worth being straight about: this last one is not what was breaking mobile board —
`shrink-0` was. With snap left on, Chromium still auto-scrolled to the far
column, just jumping to the snap point instead of easing there. So it rests on
documented behaviour plus the programmatic snap-back we did observe, not on a
reproduced broken drag. WebKit, where the e2e is aimed, couldn't be launched
locally to check.

We also passed `groupBy` from `TaskList` into `TaskBoard`. It had always
accepted the prop but never received it, so board drops silently ran on
`getTaskUpdatesForGroup`'s heuristic cascade, where a project named "Today"
reads as a date bucket.

Stacking columns vertically on mobile was the obvious alternative to the
carousel, but the carousel was already built and is the conventional shape;
stacking turns the board into a list with extra headings. We also considered
dropping the empty-column filter on mobile only, which spares desktop but leaves
the two platforms disagreeing about what a board is.

## Consequences

- Board is reachable at every viewport. `viewMode` still defaults to `"list"`.
- Desktop gains an always-present "This Evening" column when ungrouped, and
  correctly-sized columns once there are enough to overflow.
- `BoardTaskCard` no longer takes `_isDesktop`; hover-to-reveal is CSS
  (`md:opacity-0 md:group-hover/card:opacity-100`). `isDesktop` defaults to
  `true` until `AppShell`'s effect runs, so the old JS branch made the button
  flash in on a phone's first paint.
- The snap conditional looks like a stray check. It isn't — but removing it is
  defensible if WebKit turns out not to need it.

[mdn]: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type
[dndkit]: https://github.com/clauderic/dnd-kit/issues/825
