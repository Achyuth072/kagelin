function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = base64url(bytes);
  const codeChallenge = await computeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

async function computeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64url(new Uint8Array(digest));
}

export async function verifyCodeChallenge(verifier: string, challenge: string): Promise<boolean> {
  const expected = await computeChallenge(verifier);
  return expected === challenge;
}
