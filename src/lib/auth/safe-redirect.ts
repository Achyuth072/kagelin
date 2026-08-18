/**
 * Guards the `next` query param on the auth callback (H-3), and the
 * `redirect` query param consumed by useBackAnchor. `//host` and `/\host`
 * are valid path strings that browsers treat as protocol-relative URLs,
 * redirecting off-origin, so only a path starting with exactly one `/` is
 * safe. Values are also rejected outright — not stripped — if they contain
 * a C0 control character: the WHATWG URL parser strips tab/LF/CR before
 * parsing, so e.g. `/\t/evil.com` would pass the leading-slash check here
 * and then collapse to `//evil.com` once handed to `new URL()`.
 */
export function sanitizeNextPath(next: string | null): string {
  if (next && !/[\x00-\x1f]/.test(next) && /^\/(?!\/|\\)/.test(next)) {
    return next;
  }
  return "/";
}
