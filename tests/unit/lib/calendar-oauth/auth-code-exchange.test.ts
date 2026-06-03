import { describe, it, expect, vi, beforeEach } from "vitest";
import { exchangeAuthCode } from "@/lib/calendar-oauth/auth-code-exchange";

describe("exchangeAuthCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges auth code and returns access_token and refresh_token", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ya29.access",
        refresh_token: "1//refresh",
        expires_in: 3600,
      }),
    } as Response);

    const result = await exchangeAuthCode({
      provider: "google",
      code: "auth-code-123",
      codeVerifier: "verifier-abc",
      redirectUri: "https://app.example.com/api/calendar/oauth/callback",
    });

    expect(result.accessToken).toBe("ya29.access");
    expect(result.refreshToken).toBe("1//refresh");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it("throws when provider returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_grant", error_description: "Code expired" }),
    } as Response);

    await expect(
      exchangeAuthCode({
        provider: "google",
        code: "bad-code",
        codeVerifier: "verifier-abc",
        redirectUri: "https://app.example.com/api/calendar/oauth/callback",
      }),
    ).rejects.toThrow("Code expired");
  });
});
