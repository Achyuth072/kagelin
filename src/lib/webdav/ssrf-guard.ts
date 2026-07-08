import dns from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
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
 * HTTP client) with 169.254.169.254.
 *
 * `ssrfSafeFetch` is the entry point — it assembles the whole defence
 * (validate, resolve once, pin the connection to the vetted IP, never follow
 * redirects) so callers can't hold the invariant wrong. `resolveSafeTarget`
 * and `pinnedLookup` are the primitives it is built from.
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
  /** The parsed, validated URL — the exact artifact `ssrfSafeFetch` fetches (hostname preserved for TLS SNI + Host header). */
  url: URL;
  /** The exact IP the connection must be pinned to. */
  pinnedIp: string;
  family: 4 | 6;
}

/**
 * Validates a user-supplied WebDAV URL and resolves it to a single,
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

/**
 * Pinned agents are pooled so back-to-back requests to the same server (test
 * connection → upload → download) reuse connections instead of paying a
 * fresh TCP+TLS handshake each time. Keyed by hostname + pinned IP: if DNS
 * later resolves the host to a different (freshly re-validated) address,
 * that's a new key and a new agent — the pin can never go stale.
 */
const MAX_POOLED_AGENTS = 8;
const agentPool = new Map<string, Agent>();

function getPinnedAgent(target: SafeTarget): Agent {
  const key = `${target.url.hostname}|${target.pinnedIp}`;
  const pooled = agentPool.get(key);
  if (pooled) return pooled;

  if (agentPool.size >= MAX_POOLED_AGENTS) {
    const oldest = agentPool.entries().next().value;
    if (oldest) {
      agentPool.delete(oldest[0]);
      oldest[1].close().catch(() => {});
    }
  }

  const agent = new Agent({
    connect: { lookup: pinnedLookup(target.pinnedIp, target.family) },
  });
  agentPool.set(key, agent);
  return agent;
}

/**
 * Fetches a user-supplied URL with the full SSRF defence applied: the URL is
 * validated and resolved via `resolveSafeTarget`, the connection is pinned
 * to the vetted IP, and redirects are never auto-followed (a redirect could
 * point at a private/metadata address, and following it would re-resolve
 * DNS and lose the pin — 3xx responses pass straight through to the
 * caller). Throws `SsrfBlockedError` for unsafe targets.
 */
export async function ssrfSafeFetch(
  rawUrl: string,
  init: { method: string; headers: Headers; body?: ArrayBuffer },
) {
  const target = await resolveSafeTarget(rawUrl);
  return undiciFetch(target.url, {
    method: init.method,
    headers: init.headers,
    body: init.body ?? null,
    dispatcher: getPinnedAgent(target),
    redirect: "manual",
    duplex: "half",
  });
}
