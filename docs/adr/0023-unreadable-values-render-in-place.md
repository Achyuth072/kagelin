---
status: accepted
---

# An unreadable value is marked in its row, not thrown for the whole query

ADR 0021 binds every sealed value to its Account, table, column and row. A
value moved anywhere else fails authentication, and `decryptField` throws
`TamperError`. The wrapped client decrypts a result with `Promise.all`. One bad
task title therefore fails the whole select, and the user sees no tasks at all.

The Re-seal already leaves values it cannot open in place and names them. But
it opens only values that still need sealing. A `-v2` value under the current
key that is moved later is found only by a read.

## Decisions

- **Per-value failures do not fail the query.** A `TamperError`, a malformed
  envelope, or a JSON field whose plaintext does not parse makes that one
  value unreadable. Lists, single-row selects and embedded rows all behave
  the same way. A single select that threw would make a row the list shows
  impossible to open, fix or delete.
- **A missing key still throws.** A locked keyring, or an envelope `keyId` the
  device does not hold, still throws `content_key_unavailable`. That is a
  state of the whole Account (usually a Rotation on another device, ADR 0022),
  and unlocking fixes it. It must not show up as a list of dead rows.
- **The value becomes `null`, and the row gets `unreadable: ["column", …]`.**
  The marker is a plain array, so it survives the IndexedDB persister. The
  affected fields are typed `string | null`, so typecheck finds every read that
  is not guarded.
- **A marked row is never written back** (`code: "unreadable_content"`).
  `encryptPayload` refuses any payload row that carries the marker, which
  covers the wrapped client and the service-role path. Restore and duplicate
  rebuild their payload field by field, which drops the marker, so they check
  the source row themselves. Completing a recurring task checks before it
  closes the task, so a series is never ended without its next Occurrence. The
  calendar push skips an event with the marker and leaves its `sync_state` as
  it is.
- **The row stays in place.** Its plaintext columns (dates, project, colour,
  checkmarks) are still valid. The bad field shows a muted "Can't be read"
  with a tooltip that tells the user to delete the item or type a new value.
  Search and text sort put these rows last and never match them.
- **The user can delete the item, or type a new value into an empty field.**
  Other actions work as normal. Duplicate is disabled and gives a reason. A new
  value is sealed `-v2` under the current key, so the Re-seal no longer lists
  it. The retired key is then dropped by the next clean pass without extra
  code.
- **Reported once per value per page load**, through the consent-gated
  telemetry, as one `content_unreadable` event with the table and column, so
  the event count is the value count. The row id is used only on the device,
  to skip repeats, and is never sent (ADR 0013).

## Considered Options

- **Lists replace the value, single selects keep throwing.** Rejected: the user
  could see the row but not open it to fix it. The client also cannot reliably
  tell a list from a single row, because embedded rows are arrays inside one
  row.
- **A placeholder string ("Unreadable item").** Rejected: every write-back
  would save the placeholder as real content. A duplicate would get it as its
  title, and the calendar push would send it to Google. This is the "content
  shown in the wrong place" bug in a new form.
- **A wrapper object (`{ unreadable: true }`).** Rejected: every string call
  crashes, and on `calendar_events.metadata` it cannot be told apart from real
  JSON.
- **Hide the row behind a count banner.** Rejected: it hides valid plaintext
  data, and it hides the only place where the user can fix the item.
- **A durable "Unreadable items" list in Settings.** Postponed until telemetry
  shows that tampering happens.

## Consequences

- Spec story 2 holds. The technical bullet in `.scratch/key-rotation/spec.md`
  that required a thrown error is replaced.
- A nullable encrypted column that a write-back clears loses a value that could
  not be read anyway. `NOT NULL` columns cannot reach that state, because the
  guard refuses the write first.
- A new code path that copies a cached row field by field drops the marker,
  so it must call `assertReadable` on the source row itself. A path that
  writes the row as it is is covered by `encryptPayload`.
- Exports (uHabits, ICS) write an unreadable value as empty, never as the
  placeholder text, so a re-import cannot keep the placeholder as content.
