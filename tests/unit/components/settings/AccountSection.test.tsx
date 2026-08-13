import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AccountSection,
  formatLinkError,
} from "@/components/settings/AccountSection";
import { useAuth } from "@/components/AuthProvider";
import type { User, UserIdentity } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("AccountSection", () => {
  const mockLinkIdentity = vi.fn();
  const mockUnlinkIdentity = vi.fn();
  const mockUpdatePassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAuth(userOverrides: Partial<User> = {}, isGuestMode = false) {
    const user = {
      id: "user-123",
      email: "user@example.com",
      identities: [],
      ...userOverrides,
    } as User;

    vi.mocked(useAuth).mockReturnValue({
      user,
      session: null,
      loading: false,
      isGuestMode,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: mockUpdatePassword,
      linkIdentity: mockLinkIdentity,
      unlinkIdentity: mockUnlinkIdentity,
      signInAsGuest: vi.fn(),
      signOut: vi.fn(),
    });
  }

  it("formatLinkError formats identity_already_exists error according to ADR 0012", () => {
    const err = {
      code: "identity_already_exists",
      message: "Identity is already linked",
    };
    expect(formatLinkError(err, "GitHub")).toBe(
      "That GitHub account is already linked to a different Kagelin account.",
    );
  });

  it("formatLinkError formats URL error strings and default labels", () => {
    expect(formatLinkError("Identity is already claimed")).toBe(
      "That social account is already linked to a different Kagelin account.",
    );
    expect(formatLinkError("Custom error message")).toBe(
      "Custom error message",
    );
  });

  it("disables Disconnect when exactly one identity remains", () => {
    const singleIdentity: UserIdentity = {
      identity_id: "id-1",
      id: "id-1",
      user_id: "user-123",
      provider: "google",
      created_at: new Date().toISOString(),
    };

    setupAuth({ identities: [singleIdentity] });

    render(<AccountSection />);

    const disconnectBtn = screen.getByRole("button", {
      name: "Disconnect Google",
    });
    expect(disconnectBtn).toBeDisabled();
  });

  it("enables Disconnect when more than one identity exists", () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "email",
        created_at: new Date().toISOString(),
      },
      {
        identity_id: "id-2",
        id: "id-2",
        user_id: "user-123",
        provider: "github",
        created_at: new Date().toISOString(),
      },
    ];

    setupAuth({ identities });

    render(<AccountSection />);

    const disconnectBtn = screen.getByRole("button", {
      name: "Disconnect GitHub",
    });
    expect(disconnectBtn).not.toBeDisabled();
  });

  it("shows Set Password when account has no password email identity", () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "google",
        created_at: new Date().toISOString(),
      },
    ];

    setupAuth({ identities });

    render(<AccountSection />);

    expect(screen.getByText("Set Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set password" }),
    ).toBeInTheDocument();
  });

  it("shows Change Password when account has an email identity", () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "email",
        created_at: new Date().toISOString(),
      },
    ];

    setupAuth({ identities });

    render(<AccountSection />);

    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeInTheDocument();
  });

  it("renders ADR 0012 explanation when linking an already-claimed identity", async () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "email",
        created_at: new Date().toISOString(),
      },
    ];

    setupAuth({ identities });

    mockLinkIdentity.mockResolvedValueOnce({
      error: {
        code: "identity_already_exists",
        message: "Identity is already linked to another user",
      },
    });

    render(<AccountSection />);

    const connectGitHubBtn = screen.getByRole("button", {
      name: "Connect GitHub",
    });
    fireEvent.click(connectGitHubBtn);

    await waitFor(() => {
      expect(mockLinkIdentity).toHaveBeenCalledWith("github");
      expect(
        screen.getByText(
          "That GitHub account is already linked to a different Kagelin account.",
        ),
      ).toBeInTheDocument();
    });
  });
});
