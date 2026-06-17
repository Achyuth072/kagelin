# Kagelin

> "Work quietly. Own everything."

A focused workspace for tasks, habits, focus, and your calendar. Offline-first, no account required.

**[kagelin.app](https://kagelin.app)**

## Why Kagelin

- **No account needed.** Full-featured guest mode in `localStorage` — sign up only if you want cloud sync.
- **Your data, your rules.** WebDAV sync, encrypted ZIP backups, and full data export/delete for registered users.
- **Offline-first.** Works without a connection via service worker with stale-while-revalidate caching.

## Features

### Tasks & Organization

- **Global Search** (`Ctrl/Cmd+K`): instant search across tasks, habits, and events, plus navigation and actions.
- **Three views**: Masonry Grid, Board, and List — switch with `Shift+1/2/3`.
- **Split View**: Desktop List opens a master-detail panel automatically.
- **Projects**: multi-level project structure with archiving and mobile drawers.
- **Group & Filter**: group by project, priority, or due date with drag-and-drop across groups.
- **Recurring tasks**: per-task Strict (anchors to due date) or Flexible (anchors to completion) recurrence.
- **Notes editor**: markdown formatting toolbar with live preview for task notes.

### Focus & Habits

- **Focus Timer**: PiP-enabled Pomodoro engine with real-time sync across devices.
- **Habit tracking**: standardized tracking with longevity streaks and uhabits `.db` import.
- **Compact habit view**: tappable rolling-7 day strip with drag-and-drop reordering.
- **Activity heatmap**: visualize focus minutes and habit completions over time.

### Calendar

- **Event creation**: native calendar events with NLP-assisted time parsing.
- **Multi-provider sync**: Google Calendar, Microsoft Outlook, and any CalDAV server (Nextcloud, iCloud, Fastmail).
- **ICS portability**: universal `.ics` (RFC 5545) import and export.

### Data Ownership

- **Guest Mode**: full-featured, zero-footprint experience in `localStorage` — no account needed.
- **WebDAV sync**: sync guest data with personal servers (Nextcloud, Synology) without an account.
- **Backups**: encrypted `.zip` export/import. Registered users can export or permanently delete all cloud data.
- **Offline-first PWA**: full offline support via service worker with stale-while-revalidate caching.

### Preferences

- **Time format**: system-wide 12h/24h toggle across all time displays.
- **Keyboard accessible**: Esc closes all modals, full focus-trap and `aria-modal` compliance.
- **Haptic feedback**: standardized haptic palette for precise mobile feedback.

## Shortcuts

| Shortcut          | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `1–6`             | Quick navigation (Home, Habits, Calendar, Stats, Focus, Settings) |
| `Shift+1 / 2 / 3` | Switch view (Grid / Board / List)                                 |
| `Ctrl/Cmd+K`      | Open Command Palette                                              |
| `Ctrl/Cmd+B`      | Toggle Sidebar                                                    |
| `N / H / E / P`   | Create new (Task, Habit, Event, Project)                          |
| `Shift+H`         | View all shortcuts                                                |

## Stack

- **Next.js 16.1.0** (App Router) + **React 19.2.3** (React Compiler)
- **Supabase** (Postgres, Auth, Realtime)
- **TanStack Query v5** (IndexedDB persistence) + **Zustand v5**
- **Tailwind CSS v4** + **Shadcn UI** (Radix)
- **Framer Motion** + **@dnd-kit** (flat-DOM drag-and-drop)
- **Serwist** (typed service worker, offline-first PWA)
- **tsdav** + **ical.js** (CalDAV/ICS sync)

## Setup

**Prerequisites**: Node.js 20+, a Supabase project with the schema from `supabase/schema.sql`.

```bash
git clone <repo>
npm install
cp .env.example .env.local   # add your Supabase keys
npm run dev
```

## Contributing & Feedback

Bug reports and feature requests go in [GitHub Issues](../../issues). For questions and discussion, use [GitHub Discussions](../../discussions).

## License

[AGPL-3.0](LICENSE)
