import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";

const TOKEN_ENDPOINTS: Record<string, string> = {
  google: "https://oauth2.googleapis.com/token",
  outlook: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

export interface ExchangeInput {
  provider: string;
  encryptedToken: string;
  tokenIv: string;
  encryptionKey: string;
}

export type ExchangeResult =
  | { disconnected: true }
  | {
      disconnected: false;
      accessToken: string;
      expiresAt: number;
      newEncryptedToken?: { ciphertext: string; iv: string };
    };

export async function exchangeForAccessToken(
  input: ExchangeInput,
): Promise<ExchangeResult> {
  const { provider, encryptedToken, tokenIv, encryptionKey } = input;

  const refreshToken = await decryptRefreshToken(
    encryptedToken,
    tokenIv,
    encryptionKey,
  );

  const endpoint = TOKEN_ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Unknown provider: ${provider}`);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`] ?? "",
    client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ?? "",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();

  // Only a genuine revocation (invalid_grant) means the refresh token is dead.
  if (data.error === "invalid_grant") {
    return { disconnected: true };
  }

  // Transient failures (5xx, 429, network blips surfacing as non-ok) must not be
  // treated as a disconnect — throw so the caller leaves the token row intact and
  // the sync retries on the next cycle.
  if (!response.ok) {
    throw new Error(
      `Token endpoint returned ${response.status} for ${provider}: ${data.error ?? "unknown error"}`,
    );
  }

  const result: ExchangeResult = {
    disconnected: false,
    accessToken: data.access_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
  };

  if (data.refresh_token) {
    result.newEncryptedToken = await encryptRefreshToken(
      data.refresh_token as string,
      encryptionKey,
    );
  }

  return result;
}
