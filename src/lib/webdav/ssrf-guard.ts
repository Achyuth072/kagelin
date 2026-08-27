import dns from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
import ipaddr from "ipaddr.js";

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
  url: URL;
  pinnedIp: string;
  family: 4 | 6;
}

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

  // Strip IPv6 literal brackets so dns.lookup and ipaddr agree on format.
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

// Custom lookup that returns the pinned IP to prevent DNS rebinding.
// Supports options.all array callback required by Node's autoSelectFamily.
export function pinnedLookup(pinnedIp: string, family: 4 | 6) {
  return (
    _hostname: string,
    options: { all?: boolean } | undefined,
    callback: (
      err: Error | null,
      address: string | { address: string; family: number }[],
      family?: number,
    ) => void,
  ): void => {
    if (options?.all) {
      callback(null, [{ address: pinnedIp, family }]);
    } else {
      callback(null, pinnedIp, family);
    }
  };
}

// Pool agents by hostname + pinned IP to reuse TCP/TLS connections without pinning stale IPs.
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
    // Redirects are manual so following a 3xx cannot bypass the pinned IP.
    redirect: "manual",
    duplex: "half",
  });
}
