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
      json: async () => ({
        error: "invalid_grant",
        error_description: "Code expired",
      }),
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

  it("exchanges auth code for google_tasks using Google endpoint and credentials", async () => {
    process.env.GOOGLE_CLIENT_ID = "mock-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-secret";

    let capturedUrl = "";
    let capturedBody: URLSearchParams | undefined;

    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      capturedUrl = url.toString();
      capturedBody = new URLSearchParams(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          access_token: "ya29.tasks-access",
          refresh_token: "1//tasks-refresh",
          expires_in: 3600,
        }),
      } as Response;
    });

    const result = await exchangeAuthCode({
      provider: "google_tasks",
      code: "tasks-code",
      codeVerifier: "verifier-xyz",
      redirectUri: "https://app.example.com/api/calendar/oauth/callback",
    });

    expect(capturedUrl).toBe("https://oauth2.googleapis.com/token");
    expect(
      (capturedBody as URLSearchParams | undefined)?.get("client_id"),
    ).toBe("mock-google-id");
    expect(
      (capturedBody as URLSearchParams | undefined)?.get("client_secret"),
    ).toBe("mock-google-secret");
    expect(result.accessToken).toBe("ya29.tasks-access");
    expect(result.refreshToken).toBe("1//tasks-refresh");
  });
});
