import { describe, it, expect } from "vitest";
import {
  encryptRefreshToken,
  decryptRefreshToken,
} from "@/lib/calendar-oauth/token-crypto";

const TEST_KEY = "0".repeat(64); // 32-byte key as 64 hex chars

describe("token-crypto", () => {
  it("round-trip: encrypt then decrypt returns the original token", async () => {
    const token = "ya29.a0AfH6SMBx_test_refresh_token";
    const { ciphertext, iv } = await encryptRefreshToken(token, TEST_KEY);
    const decrypted = await decryptRefreshToken(ciphertext, iv, TEST_KEY);
    expect(decrypted).toBe(token);
  });

  it("produces a different IV on each call (no nonce reuse)", async () => {
    const token = "same-token";
    const a = await encryptRefreshToken(token, TEST_KEY);
    const b = await encryptRefreshToken(token, TEST_KEY);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("decrypting with the wrong key throws", async () => {
    const token = "secret-refresh-token";
    const { ciphertext, iv } = await encryptRefreshToken(token, TEST_KEY);
    const wrongKey = "f".repeat(64);
    await expect(
      decryptRefreshToken(ciphertext, iv, wrongKey),
    ).rejects.toThrow();
  });
});
