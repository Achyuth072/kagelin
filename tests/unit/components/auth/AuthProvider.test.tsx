import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Session, User, UserIdentity } from "@supabase/supabase-js";

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
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      linkIdentity: vi.fn().mockResolvedValue({ error: null }),
      unlinkIdentity: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session } }),
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

  it("passes the given Provider straight through to supabase.auth.signInWithOAuth, redirect included", async () => {
    const supabase = mockSupabase(null);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signInWithOAuth("gitlab");

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "gitlab",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("passes email, password, captcha token and the email-confirmed redirect through to supabase.auth.signUp (Finding 3: no auto sign-in after signup confirmation)", async () => {
    const supabase = mockSupabase(null);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signUpWithPassword(
      "new@user.com",
      "hunter22",
      "captcha-token-abc",
    );

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "new@user.com",
      password: "hunter22",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/email-confirmed")}`,
        captchaToken: "captcha-token-abc",
      },
    });
  });

  it("passes email, password and captcha token through to supabase.auth.signInWithPassword", async () => {
    const supabase = mockSupabase(null);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signInWithPassword(
      "real@user.com",
      "hunter22",
      "captcha-token-abc",
    );

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "real@user.com",
      password: "hunter22",
      options: { captchaToken: "captcha-token-abc" },
    });
  });

  it("passes email, captcha token and the update-password redirect through to supabase.auth.resetPasswordForEmail", async () => {
    const supabase = mockSupabase(null);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.resetPasswordForEmail(
      "real@user.com",
      "captcha-token-abc",
    );

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "real@user.com",
      {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
        captchaToken: "captcha-token-abc",
      },
    );
  });

  it("passes the new password through to supabase.auth.updateUser", async () => {
    const supabase = mockSupabase(mockSession);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updatePassword("new-hunter22");

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "new-hunter22",
    });
  });

  it("signs out a guest by clearing the local flag, without calling Supabase", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    const supabase = mockSupabase(null);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={true}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.isGuestMode).toBe(true));

    await result.current.signOut();

    await waitFor(() => expect(result.current.isGuestMode).toBe(false));
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("kanso_guest_mode")).toBeNull();
  });

  it("signs out a registered user via Supabase, not the guest-flag path", async () => {
    const supabase = mockSupabase(mockSession);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.user?.id).toBe("real-user-id"));

    await result.current.signOut();

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("forces the account picker for google and github", async () => {
    const supabase = mockSupabase(mockSession);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.linkIdentity("github");

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings?tab=account&connecting=github")}`,
        queryParams: { prompt: "select_account" },
      },
    });

    await result.current.linkIdentity("google");

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings?tab=account&connecting=google")}`,
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("does not force an account picker for gitlab", async () => {
    const supabase = mockSupabase(mockSession);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.linkIdentity("gitlab");

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: "gitlab",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings?tab=account&connecting=gitlab")}`,
      },
    });
  });

  it("passes identity to supabase.auth.unlinkIdentity", async () => {
    const supabase = mockSupabase(mockSession);
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const identity = {
      identity_id: "id-123",
      id: "id-123",
      user_id: "real-user-id",
      provider: "github",
    };
    await result.current.unlinkIdentity(identity);

    expect(supabase.auth.unlinkIdentity).toHaveBeenCalledWith(identity);
  });

  it("refreshes the session after unlinking so the removed provider stops showing as connected (Finding 6)", async () => {
    const emailIdentity = {
      identity_id: "email-1",
      id: "email-1",
      user_id: "real-user-id",
      provider: "email",
    } as UserIdentity;
    const githubIdentity = {
      identity_id: "github-1",
      id: "github-1",
      user_id: "real-user-id",
      provider: "github",
    } as UserIdentity;

    const linkedSession = {
      user: { ...mockUser, identities: [emailIdentity, githubIdentity] },
    } as Session;
    const supabase = mockSupabase(linkedSession);
    // getSession keeps serving the cached pre-unlink snapshot, which is what
    // makes it the wrong call to refresh from.
    supabase.auth.refreshSession = vi.fn().mockResolvedValue({
      data: {
        session: { user: { ...mockUser, identities: [emailIdentity] } },
      },
    });
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialIsGuest={false}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.unlinkIdentity(githubIdentity);

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(result.current.user?.identities?.map((i) => i.provider)).toEqual([
        "email",
      ]),
    );
  });
});
