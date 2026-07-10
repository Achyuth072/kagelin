import { describe, it, expect, vi, beforeEach } from "vitest";

// #57 repro — the OAuth authorization_code grant requires the redirect_uri sent
// at token-exchange time to EXACTLY match the one sent at authorization time.
// The connect route pins it to NEXT_PUBLIC_APP_URL; the callback route derives
// it from the request origin. On Vercel the request origin can be the internal
// proxy host, so the two diverge and Google rejects the exchange
// (redirect_uri_mismatch) — nothing gets connected.

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
  capturedExchangeRedirectUri: { value: "" },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      h.cookieStore.has(name) ? { value: h.cookieStore.get(name) } : undefined,
    set: (name: string, value: string) => {
      h.cookieStore.set(name, value);
    },
    delete: (name: string) => {
      h.cookieStore.delete(name);
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) })),
  })),
}));

vi.mock("@/lib/calendar-oauth/pkce", () => ({
  generatePKCE: vi.fn(async () => ({
    codeVerifier: "test-verifier",
    codeChallenge: "test-challenge",
  })),
}));

vi.mock("@/lib/calendar-oauth/auth-code-exchange", () => ({
  exchangeAuthCode: vi.fn(async (input: { redirectUri: string }) => {
    h.capturedExchangeRedirectUri.value = input.redirectUri;
    return {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: Date.now() + 3_600_000,
    };
  }),
}));

vi.mock("@/lib/calendar-oauth/token-crypto", () => ({
  encryptRefreshToken: vi.fn(async () => ({ ciphertext: "ct", iv: "iv" })),
}));

import { GET as connectGET } from "@/../app/api/calendar/connect/[provider]/route";
import { GET as callbackGET } from "@/../app/api/calendar/oauth/callback/route";

const VERCEL_INTERNAL = "https://kagelin-abc123.vercel.app";
const PUBLIC_URL = "https://kagelin.app";

describe("#57 — OAuth redirect_uri must match between connect and callback", () => {
  beforeEach(() => {
    h.cookieStore.clear();
    h.capturedExchangeRedirectUri.value = "";
    process.env.NEXT_PUBLIC_APP_URL = PUBLIC_URL;
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.CALENDAR_TOKEN_ENC_KEY = "test-enc-key";
  });

  it("uses the same redirect_uri even when the request origin (Vercel proxy host) differs from NEXT_PUBLIC_APP_URL", async () => {
    // 1) Authorization request: pull redirect_uri out of the Google auth URL.
    const connectRes = await connectGET(
      new Request(`${VERCEL_INTERNAL}/api/calendar/connect/google`),
      { params: Promise.resolve({ provider: "google" }) },
    );
    const authUrl = new URL(connectRes.headers.get("location")!);
    const connectRedirectUri = authUrl.searchParams.get("redirect_uri");

    // 2) Token exchange: capture the redirect_uri the callback sends to Google.
    h.cookieStore.set("calendar_oauth_state", "test-state");
    h.cookieStore.set("calendar_oauth_verifier", "test-verifier");
    h.cookieStore.set("calendar_oauth_provider", "google");

    await callbackGET(
      new Request(
        `${VERCEL_INTERNAL}/api/calendar/oauth/callback?code=auth-code&state=test-state`,
      ),
    );
    const callbackRedirectUri = h.capturedExchangeRedirectUri.value;

    expect(connectRedirectUri).toBe(
      `${PUBLIC_URL}/api/calendar/oauth/callback`,
    );
    // The bug: these must be identical or Google returns redirect_uri_mismatch.
    expect(callbackRedirectUri).toBe(connectRedirectUri);
  });
});
