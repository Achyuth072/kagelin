import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLookup = vi.fn();

vi.mock("node:dns/promises", () => ({
  default: { lookup: (...args: unknown[]) => mockLookup(...args) },
}));

import {
  resolveSafeTarget,
  pinnedLookup,
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
});
