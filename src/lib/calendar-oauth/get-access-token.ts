import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeForAccessToken } from "@/lib/calendar-oauth/token-exchange";

export interface ProviderAccessToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * Server-only: read a user's encrypted refresh token (service-role), exchange it
 * for a fresh access token, and persist any rotated refresh token. Returns null
 * if the user has no token row or the provider has revoked access (in which case
 * the row is deleted so the UI shows a reconnect state). Transient token-endpoint
 * failures (5xx/429) throw and leave the row intact so a retry can recover.
 */
export async function getProviderAccessToken(
  userId: string,
  provider: string,
): Promise<ProviderAccessToken | null> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("calendar_oauth_tokens")
    .select("encrypted_refresh_token, token_iv")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (!tokenRow) return null;

  const encKey = process.env.CALENDAR_TOKEN_ENC_KEY;
  if (!encKey) throw new Error("CALENDAR_TOKEN_ENC_KEY not set");

  const result = await exchangeForAccessToken({
    provider,
    encryptedToken: tokenRow.encrypted_refresh_token,
    tokenIv: tokenRow.token_iv,
    encryptionKey: encKey,
  });

  if (result.disconnected) {
    await admin
      .from("calendar_oauth_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider);
    return null;
  }

  if (result.newEncryptedToken) {
    await admin
      .from("calendar_oauth_tokens")
      .update({
        encrypted_refresh_token: result.newEncryptedToken.ciphertext,
        token_iv: result.newEncryptedToken.iv,
      })
      .eq("user_id", userId)
      .eq("provider", provider);
  }

  return { accessToken: result.accessToken, expiresAt: result.expiresAt };
}
