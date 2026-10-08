# Features

Full feature list for [Kagelin](../README.md).

## Tasks & Organization

- **Search** (`Ctrl/Cmd+K`): instant search across tasks, habits, and events, plus navigation and actions.
- **Task views**: Board and List view with 2D keyboard navigation.
- **Vim navigation & task controls**: `gg`/`G` navigation, `yy` yank, `p` paste, and `u` undo.
- **Split View**: Desktop List opens a master-detail panel automatically.
- **Projects**: multi-level project structure with archiving and mobile drawers.
- **Group & Filter**: group by project, priority, or due date with drag-and-drop across groups.
- **Recurring tasks**: per-task Strict (anchors to due date) or Flexible (anchors to completion) recurrence.
- **Notes editor**: markdown formatting toolbar with live preview for task notes.
- **Steps (subtasks)**: add, edit, and drag-to-reorder steps in the edit sheet, with a progress badge on list and board cards.
- **Instant updates**: tasks, events, and habits update on screen immediately and roll back if saving fails.

## Focus & Habits

- **Focus Timer**: PiP-enabled Pomodoro engine that hands off between your devices, so pausing on one pauses on all of them. Shows a step checklist for the task you're focusing on.
- **Push notifications**: server-derived Web Push notifications for timer completions and task, event, and habit reminders (supporting desktop, Android, and iOS standalone PWA). Done, Snooze, and Skip buttons appear where the platform supports notification actions; iOS ignores them, so tapping the notification opens the app instead.
- **Daily briefings**: a morning brief (today's tasks, overdue items, events, pending habits) and an evening plan (what you finished, what's planned for tomorrow).
- **Habit tracking**: Yes/No and Measurable habits with frequency-aware streaks, targets, entry notes, and archive/restore.
- **Flexible frequencies**: every day, N times a week or month, every N days, or N times every D days, with last-done and next-due display.
- **Habit reminders**: follow your frequency window, with done and skip actions.
- **Skip and edit history**: mark a day as skipped from any habit screen, and open and edit any past day from habit insights.
- **Compact habit view**: collapsible drawer with a tappable rolling-7 day strip, drag-and-drop reordering, and per-day logging.
- **uhabits portability**: full-fidelity Loop Habit Tracker `.db` import and export, plus CSV and zip export, with provenance-preserving round-trips.
- **Activity heatmap**: visualize focus minutes and habit completions over time.

## Calendar

- **Flexible views**: Month, desktop 4-day, mobile week view with edge-gated paging, and rolling 3-day view.
- **Event creation**: quick event creation with natural language time parsing.
- **Multi-provider sync**: Google Calendar and Microsoft Outlook.
- **Event reminders**: set per event, with controls in the event form and notification settings.
- **ICS portability**: universal `.ics` (RFC 5545) import and export, with a confirmation step for large files and no duplicates on re-import.

## Data Ownership

- **Guest Mode**: full-featured, zero-footprint experience in `localStorage` — no account needed.
- **Accounts & Auth**: Google, GitHub, or breach-checked email/password sign-in with multi-provider identity linking and password reset. Sign out of just this device or all devices.
- **Zero-knowledge encryption**: tasks, habits, projects, labels, and calendar content are encrypted on your device under a passphrase Kagelin never sees. We can't read what you wrote — only that an item exists and when it's due. A recovery code is your backup, and you can lock your content manually or after inactivity without signing out. If you think your key leaked, rotate it: everything is re-encrypted under a new key, other devices are signed out, and only a device that holds the current key can change your passphrase, recovery code, or key. Anything that can't be decrypted shows as "Can't be read" in place, instead of breaking the whole list.
- **Diagnostic export**: a content-free bundle you can review and attach to bug reports.
- **WebDAV backup**: keep a copy of everything on a server you own (Nextcloud, Synology). Available at every tier, account or not. It is a backup, not a sync: each upload replaces the last.
- **Backups & Portability**: encrypted `.zip` export/import, guest backup reminders, and instant cloud data wipe.
- **Offline-first PWA**: full offline support via service worker with stale-while-revalidate caching.
- **Telemetry**: off by default for everyone, Guest Mode included. If you opt in, we collect anonymous product-usage counts (no task titles, habit names, or other content) tied to a random device ID, never your account.

## Stats & Insights

- **Stats page**: period selector, breakdowns by project and priority, time-of-day heatmap.
- **Item insights**: per-habit and per-recurring-task stats — score history, streaks, frequency, on-time rate.
- **Goal tracking**: progress rings on habit cards, global focus and task goals.
- **Export**: analytics CSV and JSON from stats and insights panels.

## Preferences

- **Time format**: system-wide 12h/24h toggle across all time displays.
- **Keyboard accessible**: Esc closes all modals, full focus-trap and `aria-modal` compliance.
- **Haptic feedback**: standardized haptic palette for precise mobile feedback.
