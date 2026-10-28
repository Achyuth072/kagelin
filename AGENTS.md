# AGENTS.md

Instructions for coding agents working in this repository.

## Project

Kagelin (codename Kanso) is a Next.js 16 App Router monolith backed by Supabase (Postgres + Auth + Realtime), designed local-first with cloud sync layered on top. Package manager is npm; Node >= 24. All details below assume a Linux/WSL2 dev environment.

## Commands

`npm run validate` (format:check → lint:strict → typecheck → test:run, sequentially) is the single verification gate — run it before considering work done. Under WSL2 memory limits use `npm run validate:wsl` / `npm run build:wsl` (stop `npm run dev` first for `build:wsl`). Other scripts live in `package.json`.

Gotchas the environment won't tell you:

- `npm run dev` (Turbopack) has the service worker **disabled** — Turbopack skips the Serwist wrapper entirely. To reproduce SW/offline/PWA behavior you must `npm run build && npm start` (both webpack).
- Playwright manages the dev server itself via the `webServer` block in `playwright.config.ts`. Always drive e2e through the Playwright CLI (`npm run e2e`, `npx playwright test <path>`, `npx playwright screenshot`); `e2e:chromium` is the lightweight WSL2 run.
- `npm run prepare` (runs on `npm install` via husky) copies `sql-wasm.wasm` into `public/` — required for the uhabits `.db` import feature (parsed client-side via `sql.js`).
- `npm run lint:strict` fails above 13 warnings — the budget is deliberate; don't raise it to pass a check.

## Architecture

**Two directories split routing from logic:**

- `app/` — routes, layouts, API routes only. Should stay thin: compose components from `src/components/`, don't embed business logic.
- `src/components/` — presentation, grouped by product domain (`habits/`, `tasks/`, `calendar/`, `stats/`, …), plus `ui/` (Shadcn/Radix primitives, kebab-case files) and `providers/` (app-wide context).
- `src/lib/` — everything else, by concern: data access (React Query hooks and optimistic-update mutations — components should not call `supabase.from(...)` directly), local stores (Zustand — `timerStore.ts`, `uiStore.ts`), sync adapters (CalDAV, calendar OAuth, WebDAV), uhabits import, Zod schemas, types.

**State is split by nature, not by feature**: server-owned data (tasks, habits, events) lives in TanStack Query with IndexedDB persistence; ephemeral/local UI and the focus timer live in Zustand. The timer specifically reconciles against server time (`serverClock.ts`) rather than trusting device clocks, so it survives tab suspension and cross-device handoff.

**Three user tiers gate what "sync" means** — this vocabulary is load-bearing, see [`CONTEXT.md`](CONTEXT.md) before touching anything sync-related:

- **Guest**: local-only (`localStorage`/IndexedDB), no `auth.uid()`. CalDAV only (client-held credentials); no Google/Outlook OAuth (requires server-anchored identity).
- **Registered (free)**: cloud-persisted, on-demand calendar sync (browser talks directly to Google/MS APIs using the user's own OAuth quota — keeps this tier free to run).
- **Premium (paid)**: adds realtime cross-device mirroring over Supabase Realtime and background/scheduled server-side sync.

`supabase/schema.sql` is the source of truth for the DB. Every table enforces `user_id = auth.uid()` via RLS — access control is a Postgres concern, not a middleware one.

## Conventions

- Path alias `@/*` → `./src/*` and `./*`.
- Prettier: 2-space indent, double quotes, semicolons, trailing commas everywhere. Enforced pre-commit via husky + lint-staged.
- Unused vars/params: prefix with `_` (linter ignores `^_`).
- A catch block that only does `console.*` is a lint error — rethrow, surface to the UI, or record a diagnostic error instead of swallowing it silently.
- React Compiler is on (`eslint-plugin-react-compiler` set to error) — manual `useMemo`/`useCallback` should generally be unnecessary; a compiler bailout is a smell worth checking rather than papering over.
- **Code Search Constraint**: for _structural_ searches on source files (`.ts`, `.tsx`, `.js`, `.jsx`) — a call pattern, a JSX shape, a catch block, a hook's argument list — use `ast-grep` via `Bash` (`npx ast-grep run -p '<pattern>' -l ts <path>`), not grep; it matches by AST so formatting and string contents that look like code don't fool it. Plain grep/rg is fine for simple lexical lookups (where is `addEvent` called, does this file import `X`) and for non-code files (`.md`, `.json`, `.env`). `npm run ast-grep` runs the repo's custom `.ast-grep/rules/` lint rules (advisory only, not yet part of `validate`).
- **Batch verification**: run checks together in one composite command (e.g. `npm run validate` or `git status && npm run lint`) rather than across multiple turns to preserve turn budget.
- **PR size tripwire**: when a branch's diff against `origin/dev` passes ~500 non-test lines, stop and propose the next finished slice as its own PR into `dev` before adding more. Slice by user-visible behavior (schema first, tests in the same PR), not by layer. `.husky/pre-push` prints a warning at the same threshold.

## Boundaries

- **Ask first**: schema or migration changes, auth/authz changes, new dependencies, build/deploy config, CI changes, anything cascading outside the original scope.
- **Never**: commit secrets or tokens; edit generated files by hand when a generation workflow exists; bypass a failing check with `any`, `@ts-ignore`, a disabled lint rule, or `--no-verify`; destructive git or DB operations without explicit approval.

## Where to look for more

- [`CONTEXT.md`](CONTEXT.md) — canonical domain glossary (Habit vs Entry, Streak vs Score, Goal vs Frequency, Series/Occurrence, Stats vs Insights, calendar sync terms). Read before naming anything in these domains; conflicting terminology must be resolved, not shrugged off.
- [`docs/adr/`](docs/adr/) — architecture decisions with the rejected alternatives and consequences (client-side calendar token handling, the server-anchored timer model, habit color overrides, frequency-aware streak computation). Check here before "fixing" something that looks like a bug but was a deliberate tradeoff.
- [`README.md`](README.md) — product feature list and shortcuts, useful for understanding user-facing scope.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names used as-is (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root, with supplementary docs in `.scratch/codebase/`. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
