# WebDAV is a backup escape hatch, not a sync mechanism

WebDAV Back Up / Restore exists so a user can hold their whole dataset on a
server they own, at any tier, without an account. It is deliberately **not** a
sync mechanism and the UI must never call it one.

The underlying principle: **nobody is ever forced onto Kagelin's cloud to use
Kagelin.** Guest is a full local-only tier, and WebDAV is how a Guest gets their
data off the device without giving it to us. That is the whole feature.

## Considered options

- **Real WebDAV sync** — merge the file with local state so two devices
  converge. Rejected on schema grounds before economics: no table has a
  tombstone, so "row absent from the file" is indistinguishable from "created on
  the other device" and "deleted here". Every merge would either resurrect
  deleted rows or discard new ones. Making it work means adding soft-deletes
  across six tables, `updated_at` on `habit_entries` and `focus_logs` (which
  have none), a merge algorithm, and a conflict UI. That is a sync engine, and
  it would compete directly with the premium tier it undercuts.
- **A "registered but local-only" mode** — an account whose content never
  leaves the device, with WebDAV as its cross-device path. Rejected: it is a
  Guest with a login, and it makes WebDAV the _primary_ sync path for a whole
  class of user, which is the rejected option above arriving through a side
  door. It also breaks reminders silently — due-date notifications are a
  database trigger on `tasks` feeding `notification_queue`, so with no rows in
  Postgres nothing is ever scheduled, and the user is left with a Reminders UI
  that does nothing.
- **Transactional restore via an RPC** — a `restore_user_data(jsonb)` function
  giving true atomicity, following `reorder_habits`. Rejected for now: under a
  disaster-recovery framing restore is rare and deliberate, the failure mode is
  recoverable and visible, and moving the whole restore into SQL costs the unit
  tests that currently cover it. Revisit if restore ever becomes routine — which
  under this decision it should not.
- **Comparing timestamps to detect a stale Restore** — reject or warn when the
  file predates the account's newest change. Rejected: it is a conflict model in
  disguise, and `habit_entries` and `focus_logs` have no `updated_at` at all, so
  it would be confidently wrong about the tables that change most. The
  confirmation shows the Backup's date instead and lets the person judge.

## Consequences

- **There is no conflict handling, at all.** One fixed path on the server, every
  Back Up overwrites it wholesale, nothing compares timestamps in either
  direction. Two devices backing up in turn silently discard the earlier one.
  This is acceptable _only_ because the feature is framed as backup; the framing
  is load-bearing, not cosmetic.
- **Restore writes before it prunes, and must keep doing so.** Restore runs as
  separate auto-committed PostgREST requests with no enclosing transaction, so
  wipe-then-restore would strand an empty account if any write failed part-way.
  Upserting first means a failure leaves a _superset_ of the user's data —
  recoverable, and never less than they started with. Anyone "tidying" this back
  into delete-then-insert reintroduces a total-data-loss path.
- **Row ids are preserved rather than remapped**, unlike the additive ZIP
  import, so repeated round trips converge instead of duplicating.
- **Restore is destructive and always confirmed.** Anything absent from the
  Backup is gone.
- Connected calendar accounts stay out of the payload. They carry OAuth
  material, which must not be written to a third-party server (see ADR 0001).
  A Restore therefore leaves calendar connections untouched.
- Users who want genuine cross-device convergence are pointed at the premium
  tier, not at WebDAV. This is a product boundary we are choosing, and the copy
  should say so plainly rather than implying WebDAV half-does it.
