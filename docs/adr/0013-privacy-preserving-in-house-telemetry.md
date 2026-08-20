# Privacy-preserving in-house telemetry: opt-in, zero PII, hybrid retention

Kagelin tracks app success, adoption, and feature engagement through an in-house, privacy-first telemetry subsystem backed by Next.js App Router and Supabase Postgres.

This ADR defines the architectural invariants, privacy boundaries, event catalog, and storage strategy.

---

## Architectural Invariants & Privacy Stance

1. **Zero PII (Personally Identifiable Information)**
   - No task titles, habit names, notes, project labels, emails, or free-form user strings are ever accepted or persisted.
   - Events carry only enum-based event names, action verbs, and numerical counts/durations (e.g. `duration_minutes: 25`, `display_mode: 'standalone'`).

2. **Decoupled Device Identity**
   - A random UUID (`device_id`) is generated client-side via `crypto.randomUUID()` and stored in `localStorage`.
   - `device_id` is **never** correlated with `auth.uid()`, email addresses, or user profile records.
   - IP addresses are used solely in-memory by Upstash Redis for DDoS rate-limiting at `/api/telemetry` and are immediately discarded—never persisted to Postgres.

3. **Opt-in with First-Session Consent**
   - Telemetry is disabled by default until the user explicitly grants permission.
   - Surfaced on the first session via a persistent bottom banner (not an auto-dismissing toast, since consent shouldn't lapse before a choice is made): _"Kagelin is open source & privacy-first. Share anonymous telemetry to help improve the app? [Enable] [No thanks]"_.
   - A permanent toggle exists in **Settings → Privacy & Data**.
   - Opting out immediately wipes `device_id` from local storage and halts all telemetry dispatches.

---

## Ingestion & Storage Architecture: Hybrid Raw + Rollup

To enable cohort analysis and funnel queries without unbounded database growth on Supabase free tier:

1. **Raw Event Buffer (`telemetry_events`)**
   - Holds raw anonymous events (`device_id`, `event_name`, `properties`, `created_at`).
   - Subject to an automated **30-day retention window** (pruned via scheduled Postgres pg_cron or Supabase Edge Function).
   - Serves recent funnel/retention queries (e.g. D1/D7 active device retention, PWA conversion rate).

2. **Permanent Daily Aggregates (`telemetry_daily_aggregates`)**
   - Holds pre-computed daily rollups (`date`, `active_devices`, `pwa_sessions`, `tasks_created`, `tasks_completed`, `timer_sessions_completed`, `focus_minutes_total`, `habits_logged`, `signups`).
   - Compact and permanent for multi-year trend analysis with near-zero storage footprint.

---

## Event Catalog

| Event Name         | Properties / Enums                                                                     | Purpose                                                               |
| :----------------- | :------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `app_opened`       | `display_mode: 'standalone' \| 'browser'`, `platform: 'ios' \| 'android' \| 'desktop'` | Tracks Daily Active Devices (DAD) & PWA Standalone adoption ratio.    |
| `pwa_installed`    | `platform: 'ios' \| 'android' \| 'desktop'`                                            | Measures Add to Home Screen conversion.                               |
| `task_action`      | `action: 'created' \| 'completed'`                                                     | Measures aggregate task throughput.                                   |
| `habit_logged`     | `streak_milestone?: '7' \| '30' \| '100'`                                              | Measures habit consistency and long-term adherence.                   |
| `focus_session`    | `status: 'completed' \| 'abandoned'`, `duration_minutes: number`                       | Measures focus time logged and timer completion vs. abandonment rate. |
| `signup_completed` | _(None)_                                                                               | Tracks Guest → Registered account conversion volume.                  |

---

## Operator Surface (`/admin/metrics`)

- Protected internal page at `/admin/metrics`.
- Access-gated by verifying the authenticated session against the `ADMIN_EMAILS` environment variable.
- Visualizes:
  - Total Active Devices (Daily / Weekly / Monthly)
  - PWA vs Browser usage share
  - Cumulative Focus Hours & Task completions
  - Timer completion rate (%)
  - Guest to Registered conversion rate

---

## Considered Options

- **PostHog (Cloud / Self-hosted):** Rejected. Adds an external dependency, heavier client bundle size (~30-40kb), and third-party data transmission concerns for an AGPL-3.0 local-first app.
- **Plausible / Umami:** Rejected. While lightweight, self-hosting an extra service adds operational complexity, while SaaS versions incur ongoing monthly cost.
- **Counter-Only Storage (No raw event buffer):** Rejected. Aggregate-only counters make it impossible to compute retention cohorts (e.g. D7 retention) or conversion funnels.
- **Silent Telemetry (No opt-in prompt):** Rejected. Contradicts Kagelin's local-first privacy commitment.

---

## Consequences

- **Local-first guarantee preserved:** Guest users remain 100% anonymous; telemetry carries zero personal data or task metadata.
- **Low maintenance:** Ingestion runs directly on existing Next.js App Router infrastructure with zero external SaaS fees.
- **Predictable database size:** Auto-pruning raw events at 30 days ensures storage footprint stays well within Supabase free-tier limits.
