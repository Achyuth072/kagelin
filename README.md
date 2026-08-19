<p align="center">
  <a href="https://kagelin.app">
    <img src="https://raw.githubusercontent.com/Achyuth072/kagelin/main/public/kagelin-icon.png" width="80" alt="Kagelin" />
  </a>
</p>

<div align="center">

# Kagelin

## Work quietly. Own everything

[![License: AGPL-3.0](https://img.shields.io/github/license/Achyuth072/kagelin?style=flat&labelColor=24292e)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Achyuth072/kagelin/ci.yml?branch=main&style=flat&label=CI&logo=github&logoColor=white&labelColor=24292e)](../../actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/github/deployments/Achyuth072/kagelin/production?style=flat&label=deployment&logo=vercel&logoColor=white&labelColor=24292e)](https://kagelin.app)

[![Stable](https://img.shields.io/github/v/release/Achyuth072/kagelin?style=flat&label=Stable&labelColor=06599d&color=043b69)](../../releases)
[![Preview](https://img.shields.io/github/package-json/v/Achyuth072/kagelin/dev?style=flat&label=Preview&labelColor=2c2c47&color=1c1c39)](../../releases)

[![Sponsor](https://img.shields.io/github/sponsors/Achyuth072?style=flat&logo=githubsponsors&labelColor=24292e)](https://github.com/sponsors/Achyuth072)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?style=flat&logo=kofi&logoColor=white&labelColor=24292e)](https://ko-fi.com/oneakira)

## Use it

**[app.kagelin.app](https://app.kagelin.app)** — installable as a PWA, works fully offline in guest mode. No account needed.

_Currently in preview — expect rough edges._

</div>

## Screenshots

<p align="center">
  <img src="public/screenshots/board-view-desktop.webp" alt="Board view" width="47%" />
  &nbsp;
  <img src="public/screenshots/habit-grid-desktop.webp" alt="Habit grid" width="47%" />
</p>
<p align="center">
  <img src="public/screenshots/timer-with-task.webp" alt="Focus timer" width="47%" />
  &nbsp;
  <img src="public/screenshots/calendar-monthly.webp" alt="Calendar monthly view" width="47%" />
</p>
<p align="center">
  <img src="public/screenshots/command-pallete-desktop.webp" alt="Command palette" width="70%" /><br />
  <sub>Command palette (Ctrl/Cmd+K)</sub>
</p>

## Why Kagelin

Most productivity apps want your email before you've written a single task, and keep your data on their servers either way. Kagelin doesn't.

- **Nothing to sign up for.** Tasks, habits, focus, and calendar — all offline in guest mode. Account only if you want cloud sync.
- **Your data, your server.** Point it at Nextcloud, Synology, or any WebDAV server. No middleman.
- **Take everything with you.** Encrypted ZIP export, full data deletion, and standard `.ics` files. Leaving is always an option.

## Features

### Tasks & Organization

- **Search** (`Ctrl/Cmd+K`): instant search across tasks, habits, and events, plus navigation and actions.
- **Task views**: Board and List view with 2D keyboard navigation.
- **Vim navigation & task controls**: `gg`/`G` navigation, `yy` yank, `p` paste, and `u` undo.
- **Split View**: Desktop List opens a master-detail panel automatically.
- **Projects**: multi-level project structure with archiving and mobile drawers.
- **Group & Filter**: group by project, priority, or due date with drag-and-drop across groups.
- **Recurring tasks**: per-task Strict (anchors to due date) or Flexible (anchors to completion) recurrence.
- **Notes editor**: markdown formatting toolbar with live preview for task notes.

### Focus & Habits

- **Focus Timer**: PiP-enabled Pomodoro engine with real-time sync across devices.
- **Push notifications**: server-derived Web Push notifications for timer completions and task reminders (supporting desktop, Android, and iOS standalone PWA).
- **Habit tracking**: standardized tracking with longevity streaks and uhabits `.db` import.
- **Compact habit view**: tappable rolling-7 day strip with drag-and-drop reordering.
- **Activity heatmap**: visualize focus minutes and habit completions over time.

### Calendar

- **Flexible views**: Month, desktop 4-day, mobile week view with edge-gated paging, and rolling 3-day view.
- **Event creation**: quick event creation with natural language time parsing.
- **Multi-provider sync**: Google Calendar and Microsoft Outlook.
- **ICS portability**: universal `.ics` (RFC 5545) import and export.

### Data Ownership

- **Guest Mode**: full-featured, zero-footprint experience in `localStorage` — no account needed.
- **Accounts & Auth**: Google, GitHub, or breach-checked email/password sign-in with multi-provider identity linking and password reset.
- **WebDAV sync**: sync with personal servers (Nextcloud, Synology) for self-hosted setups.
- **Backups & Portability**: encrypted `.zip` export/import, guest backup reminders, and instant cloud data wipe.
- **Offline-first PWA**: full offline support via service worker with stale-while-revalidate caching.

### Stats & Insights

- **Stats page**: period selector, breakdowns by project and priority, time-of-day heatmap.
- **Item insights**: per-habit and per-recurring-task stats — score history, streaks, frequency, on-time rate.
- **Goal tracking**: progress rings on habit cards, global focus and task goals.
- **Export**: analytics CSV and JSON from stats and insights panels.

### Preferences

- **Time format**: system-wide 12h/24h toggle across all time displays.
- **Keyboard accessible**: Esc closes all modals, full focus-trap and `aria-modal` compliance.
- **Haptic feedback**: standardized haptic palette for precise mobile feedback.

## Shortcuts

| Shortcut        | Action                                                            |
| --------------- | ----------------------------------------------------------------- |
| `1–6`           | Quick navigation (Home, Habits, Calendar, Stats, Focus, Settings) |
| `Shift+1 / 2`   | Switch view (Board / List)                                        |
| `gg / G`        | Jump to top / bottom of task list or board                        |
| `yy / p / u`    | Yank task / paste task / undo action                              |
| `Ctrl/Cmd+K`    | Open Command Palette                                              |
| `Ctrl/Cmd+B`    | Toggle Sidebar                                                    |
| `N / H / E / P` | Create new (Task, Habit, Event, Project)                          |
| `Shift+H`       | View all shortcuts                                                |

<details>
<summary><strong>Stack</strong></summary>

- **Next.js 16.2.10** (App Router) + **React 19.2.7** (React Compiler)
- **Supabase** (Postgres, Auth, Realtime)
- **TanStack Query v5** (IndexedDB persistence) + **Zustand v5**
- **Tailwind CSS v4** + **Shadcn UI** (Radix)
- **Framer Motion** + **@dnd-kit** (flat-DOM drag-and-drop)
- **Serwist** (typed service worker, offline-first PWA)
- **tsdav** (WebDAV sync) + **ical.js** (ICS import/export)

</details>

## Setup

**Prerequisites**: Node.js 20+, a Supabase project with the schema from `supabase/schema.sql` and relevant migrations from `supabase/migrations`.

```bash
git clone https://github.com/Achyuth072/kagelin.git
npm install
cp .env.example .env.local   # add all relevant keys
npm run dev
```

## Contributing & Feedback

Bug reports and feature requests go in [GitHub Issues](../../issues). For questions and discussion, use [GitHub Discussions](../../discussions).

## License

[AGPL-3.0](LICENSE)
