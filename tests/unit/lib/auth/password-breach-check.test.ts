import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sha1Hex,
  splitHash,
  suffixInResponse,
  isPasswordBreached,
} from "@/lib/auth/password-breach-check";

describe("sha1Hex", () => {
  it("derives the uppercase SHA-1 hex digest of the password", async () => {
    // Known vector: SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    expect(await sha1Hex("password")).toBe(
      "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8",
    );
  });

  it("resolves to null when crypto.subtle is unavailable", async () => {
    vi.stubGlobal("crypto", { subtle: undefined });
    try {
      expect(await sha1Hex("password")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("splitHash", () => {
  it("splits a hex digest into a 5-char prefix and the remaining suffix", () => {
    expect(splitHash("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8")).toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });
});

describe("suffixInResponse", () => {
  const body = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345\nOTHERSUFFIX:1";

  it("finds a suffix present in the response body", () => {
    expect(suffixInResponse(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(
      true,
    );
  });

  it("returns false when the suffix is absent", () => {
    expect(suffixInResponse(body, "NOTPRESENT")).toBe(false);
  });

  it("tolerates trailing carriage returns per line", () => {
    expect(suffixInResponse("ABCDEF:9\r\n", "ABCDEF")).toBe(true);
  });
});

describe("isPasswordBreached", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves true when the suffix is present in the range response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471"),
      }),
    );

    expect(await isPasswordBreached("password")).toBe(true);
  });

  it("resolves false when the suffix is absent from the range response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("SOMEOTHERSUFFIX:1"),
      }),
    );

    expect(await isPasswordBreached("a-very-unique-passphrase")).toBe(false);
  });

  it("only sends the 5-char prefix to the range endpoint, never the password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    await isPasswordBreached("password");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
  });

  it("fails open (resolves false, never rejects) on a rejected request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    await expect(isPasswordBreached("password")).resolves.toBe(false);
  });

  it("fails open on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }),
    );

    await expect(isPasswordBreached("password")).resolves.toBe(false);
  });

  it("degrades silently (resolves false) when crypto.subtle is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { subtle: undefined });

    await expect(isPasswordBreached("password")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
