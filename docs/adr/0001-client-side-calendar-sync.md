# Client-side calendar sync with token-in-memory

Google/Outlook calendar sync runs **in the browser**: the existing client-side
sync adapters call the provider APIs directly with a short-lived access token
held in memory only. A standalone OAuth consent flow (separate from login
identity) stores the **refresh token** server-side, encrypted with AES-256-GCM;
a Next.js route handler (`/api/calendar/token`) decrypts it and mints access
tokens on demand. The refresh token never reaches the browser.

We chose this because it keeps on-demand sync **free** — users spend their own
provider API quota, not our compute — which is the whole premise of making
Google/Outlook available to free registered users (background/scheduled
auto-sync is the future paid tier that does burn our compute). It also avoids
rewriting the three Phase 48 adapters to run server-side.

## Considered options

- **BFF token proxy** — token stays server-side; browser calls our endpoint
  which forwards to the provider. Rejected: every calendar API call would flow
  through our compute, contradicting the "free, user-pays-quota" premise.
- **Full server-side sync** — adapters run in an edge function. Rejected: same
  compute-cost problem, plus a rewrite, and it adopts the cost structure of the
  paid tier before the paid tier exists.

## Consequences

- A live access token sits in browser JS memory for ~1h. Accepted exposure,
  bounded by expiry and never persisted to storage; an XSS attacker on a
  logged-in session can already act against our own DB, so this is incremental,
  not categorical. Tighten CSP (Phase 61) as the compensating control.
- Google/Outlook are **registered-only** — OAuth structurally needs a
  server-anchored identity for the refresh token. Guests keep CalDAV
  (client-side credentials). This is a technical boundary, not a paywall.
