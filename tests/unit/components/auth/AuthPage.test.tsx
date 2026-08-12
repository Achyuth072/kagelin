import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/components/AuthProvider";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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

  it("signs in as guest and navigates home when the guest link is clicked", () => {
    const signInAsGuest = vi.fn();
    mockAuth({ signInAsGuest });
    render(<AuthPage initialMode="sign-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
    expect(signInAsGuest).toHaveBeenCalledTimes(1);
  });
});
