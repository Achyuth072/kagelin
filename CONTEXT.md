# Kagelin — Domain Glossary

The canonical vocabulary for Kagelin. This file is a glossary, not a spec — it
defines what terms _mean_, never how they're implemented. When a term here
conflicts with how something is being described in a plan or PR, the conflict
must be resolved before proceeding.

---

## Sync (disambiguated)

"Sync" is overloaded and must always be qualified with one of the following.
These are three distinct features with very different server-compute costs.

### On-demand calendar sync

A calendar pull/push initiated **on the user's own device** (opening the
calendar, "Sync now", a debounced post-edit push, window refocus). The browser
talks **directly** to the provider (Google / Microsoft / CalDAV) using the
user's own access token and API quota. Kagelin's only server cost is an
occasional access-token refresh. Cheap. Available to **registered users** (free
tier included).

_Not to be confused with_ realtime cross-device mirroring or background
auto-sync.

### Realtime cross-device mirroring

Live propagation of state between a user's devices over Supabase Realtime
websocket channels (e.g. the focus timer in Phase 54, live remote-calendar
change push). Costs ongoing server compute that scales with connected devices.
A **paid / premium** capability.

### Background / scheduled auto-sync

Server-side synchronisation that runs **even when the user is not in the app**
(e.g. a cron keeping calendars fresh). Costs ongoing server compute that scales
with users. A **paid / premium** capability, deferred.

---

## Tiers

### Guest

An unregistered user. Data is local-only (with optional client-side WebDAV
backup). Has no server identity (`auth.uid()`). Can use **CalDAV** (credentials
held client-side) but **not** Google/Outlook OAuth, which structurally requires
a server-anchored identity.

### Registered (free)

A user with a Kagelin account (`auth.uid()`). Data persists to the cloud. Gets
**on-demand calendar sync** for all providers. Does **not** get realtime
cross-device mirroring, background auto-sync, or push.

### Premium (paid)

A registered user who pays. Adds realtime cross-device mirroring, background
auto-sync, and push notifications on top of the registered-free capabilities.

---

## Calendar connection

### Connect Calendar (vs. login identity)

The OAuth consent flow for _granting calendar access_ is **separate** from the
login/auth identity. A user logs into Kagelin via magic link; connecting a Google
or Outlook calendar is a distinct, additional consent with calendar scopes.

### Primary calendar / write target

Of the calendars discovered on a connected account, exactly one is the **write
target** — the calendar Kagelin-authored events are pushed to. It defaults to the
account's primary calendar. All other discovered calendars are read-only (pull)
display.

### Tombstone

A locally-deleted synced event that has not yet been removed from the remote
provider. It is retained (marked) only until the deletion is pushed remotely,
then hard-deleted locally.

### kansoId

Kagelin's own event `id` (UUID), stamped into the remote event at create time via
a provider-specific extended property (Google: `extendedProperties.private.kansoId`;
MS Graph: `singleValueExtendedProperties`). Returned on read so that a subsequent
pull can recognise a just-created event and adopt its `remote_id` / `etag` without
inserting a duplicate. Distinct from `remote_id` (the provider's own event
identifier) and from `id` (the local DB primary key, which happens to be the same
value).
