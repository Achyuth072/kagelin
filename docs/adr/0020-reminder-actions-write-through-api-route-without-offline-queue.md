# Reminder actions write through an API route, with no offline queue

A Habit reminder's Done / Skip actions run in the service worker, with no page
and no React Query cache. The SW posts to an authenticated same-origin API route
(the Supabase session is cookie-based, so the request carries it, as
`/api/push/subscribe` already does), and the route writes the Entry through the
cookie server client so RLS still applies. The Entry's date comes from the
reminder payload — the producer's local date for that reminder — never from the
device clock, so tapping just after midnight records the day the reminder was
for.

If the write fails (offline, expired session), the SW replaces the reminder with
one saying the action was not saved; tapping it opens that Habit. We rejected an
IndexedDB queue replayed later: it is a small sync engine (replay trigger,
ordering, conflict with an Entry logged in the app meanwhile) for an action the
user can simply redo, and a silently deferred write is worse than a visible
failure.
