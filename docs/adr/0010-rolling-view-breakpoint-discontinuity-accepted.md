# Accept the column-count drop at the mobile/desktop breakpoint

`3day` derives its visible day count from width (3–6, same geometry as the
Day window). `app/calendar/page.tsx` swaps `3day` for `4day` at the 768px
breakpoint, and `4day` is a fixed count of 4. Just below the breakpoint
(767px), `3day` can be showing 6 columns; just above it (768px), the view
becomes `4day`'s fixed 4. Widening the window by one pixel removes two
columns — the one place this window's day count isn't monotonic in width.

## Considered options

- **Cap the rolling view's derived max at 4** — rejected: it reopens the gap
  this change exists to close. The 464–767px tablet/narrow-desktop band is
  exactly where `3day` and Week's Day window need to agree, and Week's
  window still goes up to 6 there.
- **Move or remove the 768px view-swap breakpoint** — rejected: out of
  scope. The breakpoint is `app/calendar/page.tsx`'s mobile/desktop split
  for the whole calendar page, not something owned by this view.

## Decision

Accept the discontinuity. It's only reachable by resizing a desktop browser
window through 768px or hitting that exact device width — no phone crosses
it, since `3day` is clamped to 3 below 464px. Recorded here so it reads as a
deliberate trade-off, not a bug, if someone notices it later.
