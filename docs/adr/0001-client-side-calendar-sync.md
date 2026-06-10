# Client-side calendar sync with token-in-memory

Google/Outlook calendar sync runs in the browser. Adapters call provider APIs
directly with a short-lived access token held in memory only. A separate OAuth
consent flow stores the refresh token server-side (encrypted AES-256-GCM); our
token endpoint (`/api/calendar/token`) decrypts and mints access tokens on demand.
Refresh token never touches the browser.

This keeps on-demand sync free — users spend their provider API quota, not ours.
That's the whole point of offering Google/Outlook to free users (background
auto-sync is the paid tier). Also avoids rewriting the existing adapters.

## Considered options

- **BFF token proxy** — token stays server-side; browser calls our endpoint.
  Rejected: every API call flows through our compute, killing the free-tier premise.
- **Server-side sync** — adapters in an edge function. Rejected: same compute cost,
  plus rewrite, and it adopts paid-tier economics before paid tier exists.

## Consequences

- Access token lives in browser memory for ~1h. Bounded by expiry, never persisted;
  XSS on a logged-in session can already hit our DB, so this is incremental risk.
  Compensate with CSP (Phase 61).
- Google/Outlook require login (OAuth needs server-anchored refresh token identity).
  Guests keep CalDAV with client credentials. Technical boundary, not paywall.
