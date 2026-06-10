import { describe, it, expect } from "vitest";
import { generatePKCE, verifyCodeChallenge } from "@/lib/calendar-oauth/pkce";

describe("generatePKCE", () => {
  it("codeVerifier is 43–128 URL-safe chars", async () => {
    const { codeVerifier } = await generatePKCE();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("codeChallenge is BASE64URL(SHA-256(verifier)) with no padding or + or /", async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    expect(codeChallenge).not.toContain("=");
    expect(codeChallenge).not.toContain("+");
    expect(codeChallenge).not.toContain("/");
    const isValid = await verifyCodeChallenge(codeVerifier, codeChallenge);
    expect(isValid).toBe(true);
  });

  it("each call generates a different verifier", async () => {
    const a = await generatePKCE();
    const b = await generatePKCE();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});
