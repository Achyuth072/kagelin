---
status: accepted
---

# Rotation replaces the content key; ciphertext is bound to its row

ADR 0017 deferred rotation, so a leaked content key stays valid for the life of
the Account. A **Rewrap** (passphrase change, recovery-code reissue) does not
help, because the attacker already holds the key it wraps. Separately, envelopes
carry no associated data, so anyone with DB write access can swap ciphertext
between rows of one Account without detection. We close both with one
mechanism, the **Re-seal**, and ship it in two slices: `-v2` sealing first,
then **Rotation**.

## Decisions

- **Rotation replaces the top-level key.** It creates a new content key.
  Retired keys are kept as a chain wrapped under the new key, and are deleted
  as soon as the Re-seal finishes. We rejected a two-tier scheme (a fixed master
  key wrapping a series of content keys, as Standard Notes uses for password
  changes): whoever holds the leaked top key could unwrap every new content key.
- **Rotation is always started by the user and is never automatic.** A
  passphrase change stays an instant Rewrap, as ADR 0017 intended. Rotation
  also requires a new passphrase and issues a new recovery code, because either
  one may be the thing that leaked. It signs out every other session, which
  purges any unsynced offline edits on those devices.
- **The key swap is one server-side transaction.** The new wrappers, the
  retired-key chain and `current_key_id` commit together, or not at all. The
  client prepares every wrapper before the call, and shows the new recovery code
  only after the commit. A partial swap could leave the Account with a key that
  nothing unwraps.
- **The server rejects stale writes.** The trigger that already rejects
  plaintext after migration is extended: it also rejects envelopes whose key id
  is not the user's current key, and `-v1` envelopes once the user's `-v2`
  Re-seal is complete. This turns Bitwarden's stale-session corruption into a
  clean "unlock again" error, and blocks writes from anyone holding only the
  old key.
- **`-v2` binds user id, table, column and row id as associated data.** Without
  the row id, ciphertext could still be swapped between rows. Binding it means
  **every encrypted table generates its ids on the client, before encryption**.
  Notification-queue copies are bound to their _source_ row, and the service
  worker rebuilds that binding from `taskId`/`habitId`.
- **A device does not trust the server to go backwards.** It keeps the highest
  key id and whether it has seen `sealed_v2_at`, and neither ever drops. After
  the marker, a `-v1` or plaintext value can only have been planted, so it
  shows as Can't be read (a notification copy falls back to generic copy), and
  the Re-seal reports or drops it instead of sealing it. An unlock against a
  key row with a lower key id than one this device has unlocked under is
  refused, so a rolled-back row cannot make a retired key current again. The
  cost: restoring the key row from a backup taken before a rotation locks out
  every device that has unlocked under the newer key.
- **Every change to the key row needs proof of the content key.** A Rewrap,
  the migration and Re-seal markers, and clearing retired keys go through
  `update_encryption_key_row`, which checks the same `rotation_verifier` as a
  Rotation. Without it, a stolen session could replace the wrappers and lock
  the owner out. A session may still backfill a missing verifier (trust on
  first use, for Accounts set up before it existed), and flag a passphrase
  reset, so the recovery-code unlock itself never depends on the proof. A device that
  unlocks against a verifier that belongs to another key reports it.
- **Existing users move to `-v2` automatically**, through a Re-seal on unlock.
  The app stays usable during a Re-seal: reads use the keyring, writes use the
  current key, and any unlocked device resumes an unfinished pass. A Rotation
  that starts during an unfinished upgrade replaces it.

## Consequences

- **Rollback is not covered.** Replaying an older ciphertext of the same field
  into the same row still passes authentication. Detecting it needs a version
  counter; this is recorded as a remaining gap in the threat matrix.
- **Backups outlive a Rotation.** Nightly R2 snapshots keep pre-rotation
  ciphertext and wrappers for up to 30 days. The rotation screen and the privacy
  policy must say so, and must not claim that protection is immediate.
- **Every server check of the scheme literal must learn `-v2`**: the plaintext
  backstop, `encrypted_notification_body`, and the habit-notes trigger.
