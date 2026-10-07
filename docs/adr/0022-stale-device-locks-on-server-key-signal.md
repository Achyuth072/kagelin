---
status: accepted
---

# A Stale device locks itself when the server refuses its key

ADR 0021 makes the server reject writes sealed with a retired content key
(`HINT 'content_key_retired'`). The client mapped that only to a toast. The
encryption gate checks the key row on mount and on recheck, so a **Stale
device** stayed "unlocked" and every save failed until a reload. A device whose
access token outlives the Rotation's `signOut({ scope: "others" })` hits this
for up to an hour.

## Decisions

- **`content_key_retired` makes the gate recheck. It does not lock blindly.**
  The gate re-reads the key row from the server. It purges and asks to unlock
  only when the row's `current_key_id` is newer than the local keyring. This is
  the same path the gate already takes on mount. A false alarm costs nothing.
- **The recheck is silent.** The signal path never shows the loading state,
  because that state unmounts the app, and with it an open recovery code. The
  status changes only when a purge is needed.
- **The gate ignores the signal while the rotation dialog shows the recovery
  code.** A write sealed with the old key can be in flight during this device's
  own Rotation. The recovery code is shown once and must not be lost to that
  race.
- **The device locks. It is not signed out.** On that device, the owner needs
  only the new passphrase. The revoked refresh token already ends the session
  when the access token expires. Spec story 29 is reworded to match.
- **Unsynced changes on the Stale device are dropped.** The purge clears the
  mutation cache, as the rotation dialog already warns. Keeping them would leave
  plaintext on disk while Locked. The unlock screen says the key changed on
  another device and that unsynced changes were discarded.
- **`wrapClient` emits the signal where it maps the server hint.** Every server
  write goes through it, including mutations, calendar sync, imports and the
  Re-seal, so no caller has to cooperate. The gate subscribes. We rejected the
  QueryClient `mutationCache.onError`, which misses everything that is not a
  mutation, and a `uiStore` flag, which stores an event as state.
- **The retired-key error is silent in toasts.** `handleMutationError` and the
  sync error text tell it apart from the local "no key on this device" error by
  its `hint`. The unlock screen is the message. Toasts would only repeat it, one
  for each failed write.
- **`app_update_required` does not lock.** A stale app is not a leaked key. The
  same signal shows a single sticky toast with a Reload action instead of one
  toast for each failed write.
- **A Rotation that cannot save the new key on this device stops writes at
  once.** The keyring is cleared when the Rotation commits, so old-key writes
  fail on the device and never reach the server. The recovery code stays on
  screen, and Done locks. If clearing fails too (the same storage that failed
  the save), the server backstop still rejects those writes.

## Consequences

- **Locking is no longer only a user choice.** A Stale device is the one case
  where Kagelin locks by itself. CONTEXT.md names the exception.
- **A sync that runs at the moment of the lock records an error** on its
  calendar, because its remaining writes find no key. The next sync after unlock
  clears it. We accept this rather than add a branch for a short window.
- **A false alarm still costs one key-row fetch.** Several failed writes in one
  burst cause several silent rechecks. They can overlap, which is safe because
  the purge is idempotent.
