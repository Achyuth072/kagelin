import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const mockUser = { id: "real-user-id", email: "real@user.com" } as User;
const mockSession = { user: mockUser } as Session;

function mockSupabase(session: Session | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      // Real Supabase fires INITIAL_SESSION right after subscribing.
      onAuthStateChange: vi.fn((callback) => {
        queueMicrotask(() => callback("INITIAL_SESSION", session));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "kanso_guest_mode=; path=/; max-age=0";
  });

  it("lets a real Supabase session override a stale guest flag", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    document.cookie = "kanso_guest_mode=true; path=/";
    vi.mocked(createClient).mockReturnValue(
      mockSupabase(mockSession) as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={true}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isGuestMode).toBe(false);
    });

    expect(result.current.user?.id).toBe("real-user-id");
    expect(localStorage.getItem("kanso_guest_mode")).toBeNull();
    expect(document.cookie).not.toContain("kanso_guest_mode=true");
  });

  it("stays in guest mode when there is no real session, including after the INITIAL_SESSION event fires", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    vi.mocked(createClient).mockReturnValue(
      mockSupabase(null) as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={true}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isGuestMode).toBe(true);
    expect(result.current.user?.id).toBe("guest");

    // The queued INITIAL_SESSION(null) event must not stomp guest mode.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isGuestMode).toBe(true);
    expect(result.current.user?.id).toBe("guest");
  });
});
