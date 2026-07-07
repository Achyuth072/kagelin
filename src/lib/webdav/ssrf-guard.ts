import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * SSRF guard for the WebDAV proxy (`/api/webdav/[[...path]]`).
 *
 * The proxy is intentionally unauthenticated (guest backup depends on it) and
 * forwards to a user-supplied server URL, so it must defend itself against
 * being used to reach internal/cloud-metadata addresses. A naive
 * "resolve host, reject private IPs, then fetch the hostname" check is
 * DNS-rebinding-bypassable: an attacker's DNS server can answer the
 * validation lookup with a public IP and a later lookup (made by the actual
 * HTTP client) with 169.254.169.254. `resolveSafeTarget` closes that gap by
 * resolving once and handing back the exact IP the caller must pin the
 * connection to (see `pinnedLookup`) instead of resolving twice.
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPubliclyRoutable(ip: string): boolean {
  let addr = ipaddr.parse(ip);

  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      addr = v6.toIPv4Address();
    }
  }

  return addr.range() === "unicast";
}

export interface SafeTarget {
  /** The parsed, validated target URL (hostname unchanged — used for TLS SNI + Host header). */
  url: URL;
  /** The exact IP the connection must be pinned to. */
  pinnedIp: string;
  family: 4 | 6;
}

/**
 * Validates a user-supplied WebDAV base URL and resolves it to a single,
 * pre-vetted IP. Throws `SsrfBlockedError` for anything unsafe.
 */
export async function resolveSafeTarget(rawUrl: string): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Invalid WebDAV server URL");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfBlockedError(`Scheme not allowed: ${url.protocol}`);
  }

  // Strip IPv6 literal brackets (`[::1]` -> `::1`) so dns.lookup/ipaddr agree
  // on the same string; hostnames never contain brackets.
  const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");

  let resolved: { address: string; family: number };
  try {
    resolved = await dns.lookup(hostname);
  } catch {
    throw new SsrfBlockedError("Could not resolve WebDAV server host");
  }

  if (!isPubliclyRoutable(resolved.address)) {
    throw new SsrfBlockedError(
      "WebDAV server resolves to a private, link-local, or otherwise disallowed address",
    );
  }

  return {
    url,
    pinnedIp: resolved.address,
    family: resolved.family === 6 ? 6 : 4,
  };
}

/**
 * Builds a `connect.lookup` function for an undici `Agent` that ignores
 * whatever DNS says at connect time and always returns the address that was
 * already validated by `resolveSafeTarget` — this is what actually closes
 * the rebinding TOCTOU, not just the upfront check.
 */
export function pinnedLookup(pinnedIp: string, family: 4 | 6) {
  return (
    _hostname: string,
    _options: unknown,
    callback: (err: Error | null, address: string, family: number) => void,
  ): void => {
    callback(null, pinnedIp, family);
  };
}
