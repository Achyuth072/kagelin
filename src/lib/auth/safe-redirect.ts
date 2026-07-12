/**
 * Guards the `next` query param on the auth callback (H-3). It's spliced
 * into a same-origin string (`${origin}${next}`), so an absolute URL is
 * already rejected by that construction — but `//host` and `/\host` are
 * still valid path strings that browsers treat as protocol-relative URLs,
 * redirecting off-origin. Only a path starting with exactly one `/` is safe.
 */
export function sanitizeNextPath(next: string | null): string {
  if (next && /^\/(?!\/|\\)/.test(next)) {
    return next;
  }
  return "/";
}
