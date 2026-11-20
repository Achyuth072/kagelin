import { describe, it, expect, vi, beforeEach } from "vitest";
import { exchangeForAccessToken } from "@/lib/calendar-oauth/token-exchange";
import {
  encryptRefreshToken,
  decryptRefreshToken,
} from "@/lib/calendar-oauth/token-crypto";

const TEST_KEY = "a".repeat(64);
const REFRESH_TOKEN = "1//refresh-token-value";

async function makeStoredToken() {
  return encryptRefreshToken(REFRESH_TOKEN, TEST_KEY);
}

describe("exchangeForAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("decrypts stored token, exchanges with Google, returns access_token and expires_at", async () => {
    const { ciphertext, iv } = await makeStoredToken();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ya29.new-access-token",
        expires_in: 3600,
      }),
    } as Response);

    const result = await exchangeForAccessToken({
      provider: "google",
      encryptedToken: ciphertext,
      tokenIv: iv,
      encryptionKey: TEST_KEY,
    });

    expect(result.disconnected).toBeFalsy();
    if (result.disconnected) return;
    expect(result.accessToken).toBe("ya29.new-access-token");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it("when provider returns a rotated refresh_token, includes re-encrypted token in result", async () => {
    const { ciphertext, iv } = await makeStoredToken();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ya29.access",
        expires_in: 3600,
        refresh_token: "new-rotated-refresh-token",
      }),
    } as Response);

    const result = await exchangeForAccessToken({
      provider: "google",
      encryptedToken: ciphertext,
      tokenIv: iv,
      encryptionKey: TEST_KEY,
    });

    expect(result.disconnected).toBeFalsy();
    if (result.disconnected) return;
    expect(result.newEncryptedToken).toBeDefined();
    const decrypted = await decryptRefreshToken(
      result.newEncryptedToken!.ciphertext,
      result.newEncryptedToken!.iv,
      TEST_KEY,
    );
    expect(decrypted).toBe("new-rotated-refresh-token");
  });

  it("invalid_grant response → returns disconnected: true", async () => {
    const { ciphertext, iv } = await makeStoredToken();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const result = await exchangeForAccessToken({
      provider: "google",
      encryptedToken: ciphertext,
      tokenIv: iv,
      encryptionKey: TEST_KEY,
    });

    expect(result.disconnected).toBe(true);
  });

  it("transient 503 → throws and does not report disconnected", async () => {
    const { ciphertext, iv } = await makeStoredToken();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "backend_unavailable" }),
    } as Response);

    await expect(
      exchangeForAccessToken({
        provider: "google",
        encryptedToken: ciphertext,
        tokenIv: iv,
        encryptionKey: TEST_KEY,
      }),
    ).rejects.toThrow(/503/);
  });

  it("429 rate limit → throws rather than disconnecting", async () => {
    const { ciphertext, iv } = await makeStoredToken();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limit_exceeded" }),
    } as Response);

    await expect(
      exchangeForAccessToken({
        provider: "google",
        encryptedToken: ciphertext,
        tokenIv: iv,
        encryptionKey: TEST_KEY,
      }),
    ).rejects.toThrow(/429/);
  });

  it("exchanges refresh token for google_tasks using Google endpoint and credentials", async () => {
    process.env.GOOGLE_CLIENT_ID = "mock-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-secret";

    const { ciphertext, iv } = await makeStoredToken();
    let capturedUrl = "";
    let capturedBody: URLSearchParams | undefined;

    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      capturedUrl = url.toString();
      capturedBody = new URLSearchParams(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          access_token: "ya29.tasks-refreshed",
          expires_in: 3600,
        }),
      } as Response;
    });

    const result = await exchangeForAccessToken({
      provider: "google_tasks",
      encryptedToken: ciphertext,
      tokenIv: iv,
      encryptionKey: TEST_KEY,
    });

    expect(capturedUrl).toBe("https://oauth2.googleapis.com/token");
    expect(
      (capturedBody as URLSearchParams | undefined)?.get("client_id"),
    ).toBe("mock-google-id");
    expect(
      (capturedBody as URLSearchParams | undefined)?.get("client_secret"),
    ).toBe("mock-google-secret");
    expect(result.disconnected).toBe(false);
    if (!result.disconnected) {
      expect(result.accessToken).toBe("ya29.tasks-refreshed");
    }
  });
});
