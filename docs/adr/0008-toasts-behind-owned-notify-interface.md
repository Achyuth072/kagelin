# Toasts go through `notify`, not Sonner

21 files import `toast` from `sonner` directly, across roughly 90 call sites —
the entire Sonner API was our toast API. That's how `description` and `action`
ended up on the same toast: Sonner's own type permits it, and nothing stopped a
call site from using both. With `toastOptions.unstyled: true` set, our Tailwind
classes are the only layout left (Sonner gates almost all its CSS behind
`[data-styled='true']`), so a toast is a single flex row — icon, content, then a
`shrink-0` action button. A row carrying title + description + action reliably
blows past the 24rem width cap, and `shrink-0` forces the text to absorb all the
overflow and wrap. The backup reminder was the reported case; "Task deleted" in
`useTaskMutations.ts` is worse, since its description is arbitrary user-authored
task text with no bounded width. Same tension reported upstream in
[shadcn-ui/ui#4070][shadcn].

## Decision

`description` and `action` become mutually exclusive, enforced by a
discriminated union on `notify`'s options type — the only way to make the
illegal combination unrepresentable, since Sonner's own signature permits it.
The three sites that used `description` fold it into the title instead, so
every toast is one line plus at most one action. Errors keep `description`,
since none of the 45 `toast.error` calls carry an action.

The interface mirrors Sonner's severity levels (`success` / `error` / `warning`
/ `info` / `loading` / `dismiss`) rather than inventing a `reminder` category for
"might become a native OS notification later." That category would have grouped
an Undo toast, a session-complete announcement, a cross-device sync notice, and
the actual backup reminder as one thing — and an Undo toast must never escalate
to the system tray, since its action is only valid while the app is
foregrounded.

`no-restricted-imports` blocks importing `sonner` outside `notify.ts` and the
Toaster. A constraint that lives only in a wrapper anyone can route around is a
convention, and the bug above is what that erosion looks like in practice.

We considered justifying this purely as prep for swapping in
`@capacitor/local-notifications` later — Capacitor's own docs recommend exactly
this "one interface, swappable implementation" shape. But ~90 call sites is a
find-and-replace whenever we want one; that alone was never reason enough. The
seam earns its cost from the type constraint it enforces today, not from a
future swap.

We also considered platform-adaptive styling — a Material snackbar on Android, a
HIG banner on iOS — to address "toasts feel web-y" more broadly. Rejected for
now: Sonner has no platform primitive, so it would mean hand-built user-agent
detection plus two visual variants to maintain, in service of impersonating
components a real native shell will eventually provide anyway. Native feel comes
instead from restraint — consistent one-line sizing and the existing
`ease-seijaku` motion. Multi-toast stacking (`expand={true}`) is a separate,
unrelated polish item this decision doesn't touch — see Consequences.

## Consequences

- `src/components/ui/notification.tsx` becomes `toaster.tsx` — it exports
  `Toaster` and always did; the old name collided with
  `src/lib/notifications.ts` (service-worker push) and
  `NotificationSettings.tsx` (push settings). See CONTEXT.md, "Notifications
  (disambiguated)".
- A future toast wanting both a description and an action is a compile error.
  That's the point — the error should point here.
- `expand={true}` (multi-toast stacking) and Sonner's default `visibleToasts`
  are untouched by this decision. Research flagged the Material single-snackbar
  convention as a divergence worth reconsidering, but it's a separate, unrelated
  polish item — not addressed here.

[shadcn]: https://github.com/shadcn-ui/ui/issues/4070
