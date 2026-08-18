import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { AccountSection } from "@/components/settings/AccountSection";
import { formatLinkError } from "@/lib/auth/format-auth-error";
import { useAuth } from "@/components/AuthProvider";
import type { User, UserIdentity } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockUseSearchParams = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("AccountSection", () => {
  const mockLinkIdentity = vi.fn();
  const mockUnlinkIdentity = vi.fn();
  const mockUpdatePassword = vi.fn();
  const mockReauthenticate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockReauthenticate.mockResolvedValue({ error: null });
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
      reauthenticate: mockReauthenticate,
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
  });

  it("formatLinkError substitutes a generic message for unrecognized URL error strings instead of reflecting them", () => {
    expect(formatLinkError("Custom error message")).toBe(
      "Failed to link account. Please try again.",
    );
  });

  it("formatLinkError uses a redirect error_code when the message has no .code of its own", () => {
    expect(
      formatLinkError(
        "Some future wording",
        "GitHub",
        "identity_already_exists",
      ),
    ).toBe(
      "That GitHub account is already linked to a different Kagelin account.",
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

    renderWithQueryClient(<AccountSection />);

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

    renderWithQueryClient(<AccountSection />);

    const disconnectBtn = screen.getByRole("button", {
      name: "Disconnect GitHub",
    });
    expect(disconnectBtn).not.toBeDisabled();
  });

  it("shows Set Password when has_password() reports no password set, even with an email identity present (magic-link-only account)", async () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "email",
        created_at: new Date().toISOString(),
      },
    ];
    mockRpc.mockResolvedValue({ data: false, error: null });

    setupAuth({ identities });

    renderWithQueryClient(<AccountSection />);

    await waitFor(() => {
      expect(screen.getByText("Set Password")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Set password" }),
    ).toBeInTheDocument();
  });

  it("shows Change Password when has_password() reports a password is set", async () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "email",
        created_at: new Date().toISOString(),
      },
    ];
    mockRpc.mockResolvedValue({ data: true, error: null });

    setupAuth({ identities });

    renderWithQueryClient(<AccountSection />);

    await waitFor(() => {
      expect(screen.getByText("Change Password")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeInTheDocument();
  });

  it("re-checks has_password() after successfully setting a password", async () => {
    const identities: UserIdentity[] = [
      {
        identity_id: "id-1",
        id: "id-1",
        user_id: "user-123",
        provider: "google",
        created_at: new Date().toISOString(),
      },
    ];
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockUpdatePassword.mockResolvedValue({ error: null });

    setupAuth({ identities });

    renderWithQueryClient(<AccountSection />);

    await waitFor(() => {
      expect(screen.getByText("Set Password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith("hunter2222", undefined);
    });
    // Initial mount + the post-success refetch.
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  });

  it("prompts for a verification code when GoTrue requires reauthentication, then retries with the nonce", async () => {
    mockUpdatePassword
      .mockResolvedValueOnce({
        error: { code: "reauthentication_needed", message: "Reauth needed" },
      })
      .mockResolvedValueOnce({ error: null });

    setupAuth();
    renderWithQueryClient(<AccountSection />);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    // Sends the nonce automatically once GoTrue reports it's required.
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm password change" }),
    );

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenLastCalledWith(
        "hunter2222",
        "123456",
      );
    });
    expect(
      screen.queryByLabelText("Verification code"),
    ).not.toBeInTheDocument();
  });

  it("trims whitespace from a pasted verification code before submitting it", async () => {
    mockUpdatePassword
      .mockResolvedValueOnce({
        error: { code: "reauthentication_needed", message: "Reauth needed" },
      })
      .mockResolvedValueOnce({ error: null });

    setupAuth();
    renderWithQueryClient(<AccountSection />);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: " 123456\n" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm password change" }),
    );

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenLastCalledWith(
        "hunter2222",
        "123456",
      );
    });
  });

  it("shows a friendly message and lets the user retry when the entered code is wrong", async () => {
    mockUpdatePassword
      .mockResolvedValueOnce({
        error: { code: "reauthentication_needed", message: "Reauth needed" },
      })
      .mockResolvedValueOnce({
        error: {
          code: "reauthentication_not_valid",
          message: "invalid nonce",
        },
      });

    setupAuth();
    renderWithQueryClient(<AccountSection />);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "wrong" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm password change" }),
    );

    expect(
      await screen.findByText(
        "That code wasn't right. Check your email and try again.",
      ),
    ).toBeInTheDocument();
    // Stays on the code-entry step rather than resending automatically.
    expect(mockReauthenticate).toHaveBeenCalledTimes(1);
  });

  it("resends the code and links to support from the verification step", async () => {
    mockUpdatePassword.mockResolvedValueOnce({
      error: { code: "reauthentication_needed", message: "Reauth needed" },
    });

    setupAuth();
    renderWithQueryClient(<AccountSection />);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(2));

    expect(
      screen.getByRole("link", { name: "Contact support" }),
    ).toHaveAttribute("href", "mailto:support@kagelin.app");
  });

  it("surfaces an error and re-enables the resend button when reauthenticate() rejects", async () => {
    mockUpdatePassword.mockResolvedValueOnce({
      error: { code: "reauthentication_needed", message: "Reauth needed" },
    });

    setupAuth();
    renderWithQueryClient(<AccountSection />);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    mockReauthenticate.mockRejectedValueOnce(new Error("network error"));
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    expect(
      await screen.findByText("Failed to send verification code"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resend code" }),
    ).not.toBeDisabled();
  });

  it("toggles password visibility when the eye icon is clicked", () => {
    setupAuth();
    renderWithQueryClient(<AccountSection />);

    const passwordInput = screen.getByLabelText("New Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");
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

    renderWithQueryClient(<AccountSection />);

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

  it("lists the email identity as connected for an email-only user, with no disconnect action", () => {
    const emailIdentity: UserIdentity = {
      identity_id: "id-1",
      id: "id-1",
      user_id: "user-123",
      provider: "email",
      created_at: new Date().toISOString(),
    };

    setupAuth({ identities: [emailIdentity] });

    renderWithQueryClient(<AccountSection />);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Disconnect Email/ }),
    ).not.toBeInTheDocument();
  });

  it("names the provider from the `connecting` param when the error round-trips through the OAuth redirect", () => {
    setupAuth();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "error=Identity+is+already+claimed&connecting=github",
      ),
    );

    renderWithQueryClient(<AccountSection />);

    expect(
      screen.getByText(
        "That GitHub account is already linked to a different Kagelin account.",
      ),
    ).toBeInTheDocument();
  });

  it("substitutes a generic message instead of reflecting an arbitrary ?error param verbatim", () => {
    setupAuth();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("error=Your+account+has+been+compromised"),
    );

    renderWithQueryClient(<AccountSection />);

    expect(
      screen.queryByText("Your account has been compromised"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Failed to link account. Please try again."),
    ).toBeInTheDocument();
  });

  it("passes the error_code redirect param through to formatLinkError", () => {
    setupAuth();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "error=Some+future+wording&error_code=identity_already_exists&connecting=github",
      ),
    );

    renderWithQueryClient(<AccountSection />);

    expect(
      screen.getByText(
        "That GitHub account is already linked to a different Kagelin account.",
      ),
    ).toBeInTheDocument();
  });
});
