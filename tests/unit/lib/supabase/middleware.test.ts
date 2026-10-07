import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type SetAllFn = (
  cookies: { name: string; value: string; options?: object }[],
) => void;

const mockGetClaims = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
let capturedSetAll: SetAllFn | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, opts: { cookies: { setAll: SetAllFn } }) => {
      capturedSetAll = opts.cookies.setAll;
      return {
        auth: {
          getClaims: mockGetClaims,
          getUser: mockGetUser,
          signOut: mockSignOut,
        },
      };
    },
  ),
}));

import { updateSession } from "@/lib/supabase/middleware";

function requestAdminMetrics() {
  return updateSession(new NextRequest("http://localhost:3000/admin/metrics"));
}

describe("updateSession cookie propagation on redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps refreshed auth cookies when redirecting an unauthenticated request", async () => {
    mockGetClaims.mockImplementation(async () => {
      capturedSetAll!([
        { name: "sb-x-auth-token", value: "REFRESHED", options: { path: "/" } },
      ]);
      return { data: null, error: null };
    });

    const res = await requestAdminMetrics();

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.cookies.get("sb-x-auth-token")?.value).toBe("REFRESHED");
  });

  it("keeps the cleared auth cookies when signOut() forces a redirect", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: "invalid claim: missing sub claim", status: 401 },
    });
    mockSignOut.mockImplementation(async () => {
      capturedSetAll!([
        {
          name: "sb-x-auth-token",
          value: "",
          options: { path: "/", maxAge: 0 },
        },
      ]);
    });

    const res = await requestAdminMetrics();

    expect(res.status).toBe(307);
    expect(res.cookies.get("sb-x-auth-token")?.value).toBe("");
  });

  it("lets a request through on verified claims without calling the Auth server", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });

    const res = await requestAdminMetrics();

    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
