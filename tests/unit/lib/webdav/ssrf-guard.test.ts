import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLookup = vi.fn();

vi.mock("node:dns/promises", () => ({
  default: { lookup: (...args: unknown[]) => mockLookup(...args) },
}));

const mockUndiciFetch = vi.fn();
const agentOptions: unknown[] = [];

vi.mock("undici", () => ({
  fetch: (...args: unknown[]) => mockUndiciFetch(...args),
  Agent: vi.fn().mockImplementation(function (this: unknown, options: unknown) {
    agentOptions.push(options);
    return { close: vi.fn(() => Promise.resolve()) };
  }),
}));

import {
  resolveSafeTarget,
  pinnedLookup,
  ssrfSafeFetch,
  SsrfBlockedError,
} from "@/lib/webdav/ssrf-guard";

describe("ssrf-guard", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  describe("resolveSafeTarget", () => {
    it("allows a public IPv4 address and pins to the resolved IP", async () => {
      mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });

      const target = await resolveSafeTarget(
        "https://dav.example.com/remote.php",
      );

      expect(target.pinnedIp).toBe("93.184.216.34");
      expect(target.family).toBe(4);
      expect(target.url.hostname).toBe("dav.example.com");
    });

    it("rejects disallowed schemes", async () => {
      await expect(resolveSafeTarget("file:///etc/passwd")).rejects.toThrow(
        SsrfBlockedError,
      );
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it("rejects an unparseable URL", async () => {
      await expect(resolveSafeTarget("not a url")).rejects.toThrow(
        SsrfBlockedError,
      );
    });

    it("rejects loopback (127.0.0.1)", async () => {
      mockLookup.mockResolvedValue({ address: "127.0.0.1", family: 4 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);
    });

    it("rejects link-local / cloud metadata (169.254.169.254)", async () => {
      mockLookup.mockResolvedValue({ address: "169.254.169.254", family: 4 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);
    });

    it("rejects private ranges (10.0.0.0/8, 192.168.0.0/16)", async () => {
      mockLookup.mockResolvedValue({ address: "10.1.2.3", family: 4 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);

      mockLookup.mockResolvedValue({ address: "192.168.1.1", family: 4 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);
    });

    it("rejects IPv6 loopback (::1)", async () => {
      mockLookup.mockResolvedValue({ address: "::1", family: 6 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);
    });

    it("rejects IPv4-mapped IPv6 addresses that unwrap to a private range", async () => {
      // ::ffff:127.0.0.1 — the exact rebinding-adjacent trick called out by the audit
      mockLookup.mockResolvedValue({ address: "::ffff:127.0.0.1", family: 6 });
      await expect(
        resolveSafeTarget("http://sneaky.example.com/"),
      ).rejects.toThrow(SsrfBlockedError);
    });

    it("rejects when the host fails to resolve", async () => {
      mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
      await expect(
        resolveSafeTarget("http://does-not-exist.invalid/"),
      ).rejects.toThrow(SsrfBlockedError);
    });
  });

  describe("pinnedLookup", () => {
    it("always calls back with the pinned IP, ignoring the hostname it's asked to resolve", () => {
      const lookup = pinnedLookup("93.184.216.34", 4);
      const callback = vi.fn();

      lookup("attacker-controlled-hostname.example", {}, callback);

      expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    });
  });

  describe("ssrfSafeFetch", () => {
    beforeEach(() => {
      mockUndiciFetch.mockReset();
    });

    it("fetches the validated URL through an agent pinned to the resolved IP, never following redirects", async () => {
      mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
      mockUndiciFetch.mockResolvedValue(new Response("ok"));

      await ssrfSafeFetch("https://pin-one.example.com/dav/file", {
        method: "PROPFIND",
        headers: new Headers({ Depth: "1" }),
      });

      const [url, init] = mockUndiciFetch.mock.calls[0] as [
        URL,
        { method: string; redirect: string },
      ];
      expect(String(url)).toBe("https://pin-one.example.com/dav/file");
      expect(init.method).toBe("PROPFIND");
      expect(init.redirect).toBe("manual");

      // The agent's lookup must ignore DNS at connect time and answer with
      // the pinned IP — that's what closes the rebinding TOCTOU.
      const { connect } = agentOptions.at(-1) as {
        connect: {
          lookup: (
            hostname: string,
            options: unknown,
            cb: (err: Error | null, address: string, family: number) => void,
          ) => void;
        };
      };
      const callback = vi.fn();
      connect.lookup("attacker-controlled.example", {}, callback);
      expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    });

    it("reuses the pooled agent across requests to the same host + IP", async () => {
      mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
      mockUndiciFetch.mockResolvedValue(new Response("ok"));

      const agentsBefore = agentOptions.length;
      await ssrfSafeFetch("https://pin-two.example.com/a", {
        method: "GET",
        headers: new Headers(),
      });
      await ssrfSafeFetch("https://pin-two.example.com/b", {
        method: "GET",
        headers: new Headers(),
      });

      expect(agentOptions.length).toBe(agentsBefore + 1);
      expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    });

    it("throws before fetching when the target is unsafe", async () => {
      mockLookup.mockResolvedValue({ address: "169.254.169.254", family: 4 });

      await expect(
        ssrfSafeFetch("http://sneaky.example.com/", {
          method: "GET",
          headers: new Headers(),
        }),
      ).rejects.toThrow(SsrfBlockedError);
      expect(mockUndiciFetch).not.toHaveBeenCalled();
    });
  });
});
