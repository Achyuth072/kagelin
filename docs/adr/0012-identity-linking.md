# Identity linking: automatic and opt-in manual, never merge

Kagelin signs people in through four Providers — `email` (backing both
password and magic link), Google, GitHub, GitLab — so one Account can be
reached through several doors. Of the three ways to reconcile that, two are
built and one is refused:

- **Automatic linking** is left at Supabase's default: a Provider vouching for
  an email already held as verified attaches its Identity silently.
- **Manual linking** is enabled (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`),
  surfaced in Settings as a Connect button per unconnected Provider — the only
  route when a Provider's email differs from the Account's, e.g. a GitHub
  account with a private email.
- **Merging two existing Accounts** is not supported, in any form.

## Considered Options

- **Automatic linking only, no Settings surface.** Rejected: works fine until
  a Provider's email doesn't match the Account's, and then that Provider is
  permanently unusable for that person, with no way to find out why.
- **Manual linking as the fix for duplicate Accounts.** Rejected — it isn't
  one. `linkIdentity()` only attaches an Identity that belongs to no Account
  yet; `auth.identities` is unique per (provider, provider_id), so it can't
  move an Identity off an Account it's already claimed. It prevents
  duplicates only for someone who links _before_ first signing in via that
  Provider. It repairs nothing after the fact.
- **Build an account-merge feature.** Rejected as disproportionate. It would
  mean re-pointing `user_id` across every user-scoped table, reconciling two
  `profiles` rows (`is_premium` may be set on either), and deciding what
  happens to two Inbox projects — a real subsystem, for a population that
  hasn't been measured. Stays refused until the operator runbook proves too
  slow.

## Consequences

**Order matters, and the failure is silent.** Manual linking only works while
the Identity is unclaimed. Sign in with GitHub once before linking it, and a
second Account already exists — "Connect GitHub" then fails with
`identity_already_exists`. The Settings error must say so plainly ("that GitHub
account is already linked to a different Kagelin account"), not surface the
raw provider message.

**This is permanent, not a launch-window problem.** The founding-cohort
waitlist has its own (accepted, temporary) email-mismatch gap. Duplicate
Accounts are a different problem that happens to look similar: it recurs for
any user, forever.

**Recovery is a manual, operator action.** No self-serve fix exists.
`.planning/81-duplicate-account-runbook.md` covers re-pointing an orphaned
Account's data onto the real one — the agreed cost of not building merge.

**Unlinking needs a floor.** Supabase refuses to unlink an Account's last
Identity, so Disconnect must be disabled on it rather than left to fail. A
password Account's `email` Identity counts toward that floor.

**Manual linking is still beta upstream** and per-project configuration — a
setup step on both the dev and prod Supabase projects, not something the repo
can assert.

## Open question

Does a GitHub account with "Keep my email addresses private" hand Supabase the
real verified address, or `@users.noreply.github.com`? Real means automatic
linking usually just works; noreply means mismatches are the common case and
the Settings connect flow carries real weight.

Test with one such account: sign in, then read the stored email in the
Supabase dashboard's user list. Record the answer here and delete this
section.
