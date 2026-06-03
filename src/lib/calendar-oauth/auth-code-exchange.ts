const TOKEN_ENDPOINTS: Record<string, string> = {
  google: "https://oauth2.googleapis.com/token",
  outlook: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

export interface AuthCodeExchangeInput {
  provider: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface AuthCodeExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function exchangeAuthCode(input: AuthCodeExchangeInput): Promise<AuthCodeExchangeResult> {
  const { provider, code, codeVerifier, redirectUri } = input;

  const endpoint = TOKEN_ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Unknown provider: ${provider}`);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`] ?? "",
    client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ?? "",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const description = (data.error_description as string) ?? (data.error as string) ?? "Auth code exchange failed";
    throw new Error(description);
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
  };
}
