# Synthetic back anchor for cold-opened routes

A notification click (`clients.openWindow` in `app/sw.ts`) opens Kagelin directly at
a deep route such as `/focus` with an empty history stack, so the in-app back
affordance's `router.back()` closed the PWA instead of navigating. On cold open at
a non-root route we therefore synthesise history: `router.replace("/")` followed by
`router.push(target)`, leaving a **back anchor** — a `/` entry beneath the route the
user actually asked for. Back navigation then lands on the home page, in-app.

## Considered Options

- **Back button pushes `/` instead of calling `back()`.** Fixes the cold-open case
  but breaks the in-app case, where back must return to wherever the user came
  from, not to home.
- **Intercept `popstate` and cancel the exit.** The browser gives no reliable way to
  cancel a back that has no prior entry, and the interception would have to stay
  armed for the tab's lifetime.
- **Synthesise the history entry once, at startup.** Chosen: the fix is confined to
  app startup, and every back affordance — button, OS gesture, hardware key — then
  works through the normal history stack with no further special-casing.

## Consequences

`history.pushState` cannot be used directly: it desyncs App Router's own history
tracking, after which a later `router.push()` silently no-ops. The anchor must be
installed from a component that survives its own `replace()` — `AppShell`, not
`Template`, which remounts on every navigation.

The bounce is asynchronous and observable: for a moment after cold open the app is
on `/`, then on the target. Anything that reads the route during startup sees both.
Automated tests must wait it out rather than assume the landing route is stable,
which is what `window.__backAnchorSettled` and `waitForBackAnchor` exist for.

Back navigation waits for the anchor to **settle**, not to succeed. An interrupted
bounce — the user navigating mid-flight — leaves no anchor, and back may then still
exit the PWA. That is deliberate: a degraded back beats a dead one.

The failure mode being guarded against is specific and was observed, not imagined:
cold-opening `/login` anchored it like any other route, but middleware bounces its
`replace("/")` straight back and the router resolves that redirect without ever
committing `/` as a rendered pathname, so the effect never re-ran and nothing
settled. The settle state is module-global, so it outlived the login — signing in
carried the stuck promise into the app and killed every back button in the tab.

Two guards fix this, at different depths. `/login` is skipped from anchoring
entirely — it's not an in-app back destination, so bouncing it was pointless
regardless. That alone doesn't generalize: a future route with the same
never-commits-`/` redirect would reintroduce the bug. So `settle()` itself now
carries a timeout, armed the moment a bounce starts and cleared the instant it
lands — any route that swallows its bounce still settles, just late, within
`SETTLE_BACKSTOP_MS`. The value is a production UX bound, not a network budget:
client-side App Router navigation doesn't hit the request-latency issues a dev
server does, so it can stay short. (The 25s Playwright waits in
`waitForBackAnchor` are a separate number, sized for `next dev`/Turbopack
hydration under parallel test workers — a test-environment concern, not
something `SETTLE_BACKSTOP_MS` needs to cover.)
