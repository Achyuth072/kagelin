import { describe, it, expect, vi, beforeEach } from "vitest";
import { exchangeForAccessToken } from "@/lib/calendar-oauth/token-exchange";
import { encryptRefreshToken, decryptRefreshToken } from "@/lib/calendar-oauth/token-crypto";

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
});
