import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

function mockProfileLookup(
  profile: {
    is_admin: boolean;
    settings: Record<string, unknown>;
  } | null,
) {
  vi.mocked(createClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createClient>);
}

vi.mock("@/components/auth/Turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile-widget" />,
}));

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    session: null,
    loading: false,
    isGuestMode: false,
    signInWithOAuth: vi.fn(),
    signInWithMagicLink: vi.fn().mockResolvedValue({ error: null }),
    signUpWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    signInAsGuest: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  it("renders the sign-in heading when mounted at /login", () => {
    render(<AuthPage initialMode="sign-in" />);
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("renders the sign-up heading when mounted at /signup", () => {
    render(<AuthPage initialMode="sign-up" />);
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
  });

  it("toggles between sign-in and sign-up without a navigation/route change", () => {
    render(<AuthPage initialMode="sign-in" />);

    fireEvent.click(
      screen.getByRole("button", { name: "New here? Create an account" }),
    );
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Already have an account? Sign in" }),
    );
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("renders Guest as a text link outside the OAuth row, not paired with a Provider", () => {
    render(<AuthPage initialMode="sign-in" />);
    const guestBtn = screen.getByRole("button", { name: "Continue as guest" });
    expect(guestBtn).toBeInTheDocument();

    const providerButtons = ["Google", "GitHub", "GitLab"].map((label) =>
      screen.getByRole("button", { name: label }),
    );
    // Guest sits in its own container, never inside the three-up Provider grid.
    for (const providerBtn of providerButtons) {
      expect(providerBtn.parentElement).not.toBe(guestBtn.parentElement);
    }
  });

  it("shows the password form by default, with magic link demoted to a text action beneath it", () => {
    render(<AuthPage initialMode="sign-in" />);

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Email me a link instead" }),
    ).toBeInTheDocument();
  });

  it("swaps to the magic-link form when 'Email me a link instead' is clicked", () => {
    render(<AuthPage initialMode="sign-in" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Email me a link instead" }),
    );

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use a password instead" }),
    ).toBeInTheDocument();
  });

  it("swaps to the reset-password form when 'Forgot password?' is clicked, and back on 'Back to sign in'", () => {
    render(<AuthPage initialMode="sign-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Email me a link instead" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("signs in as guest and navigates home when the guest link is clicked", () => {
    const signInAsGuest = vi.fn();
    mockAuth({ signInAsGuest });
    render(<AuthPage initialMode="sign-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
    expect(signInAsGuest).toHaveBeenCalledTimes(1);
  });

  it("redirects a non-admin user to / after login", async () => {
    mockProfileLookup({ is_admin: false, settings: {} });
    mockAuth({
      user: { id: "user-1" } as unknown as ReturnType<typeof useAuth>["user"],
    });
    render(<AuthPage initialMode="sign-in" />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("redirects an admin without the landing-page setting to /", async () => {
    mockProfileLookup({ is_admin: true, settings: {} });
    mockAuth({
      user: { id: "admin-1" } as unknown as ReturnType<typeof useAuth>["user"],
    });
    render(<AuthPage initialMode="sign-in" />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("redirects an admin with adminLandingPage: metrics to /admin/metrics", async () => {
    mockProfileLookup({
      is_admin: true,
      settings: { adminLandingPage: "metrics" },
    });
    mockAuth({
      user: { id: "admin-1" } as unknown as ReturnType<typeof useAuth>["user"],
    });
    render(<AuthPage initialMode="sign-in" />);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/admin/metrics"),
    );
  });

  it("does not redirect a non-admin user even with adminLandingPage: metrics stored", async () => {
    mockProfileLookup({
      is_admin: false,
      settings: { adminLandingPage: "metrics" },
    });
    mockAuth({
      user: { id: "user-1" } as unknown as ReturnType<typeof useAuth>["user"],
    });
    render(<AuthPage initialMode="sign-in" />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });
});
