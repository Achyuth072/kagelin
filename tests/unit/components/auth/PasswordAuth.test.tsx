import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "@/components/AuthProvider";
import { PasswordAuth } from "@/components/auth/PasswordAuth";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

let capturedOnVerify: ((token: string) => void) | null = null;
const mockTurnstileReset = vi.fn();

vi.mock("@/components/auth/Turnstile", () => ({
  Turnstile: ({
    onVerify,
    handleRef,
  }: {
    onVerify: (token: string) => void;
    handleRef?: React.RefObject<{ reset: () => void } | null>;
  }) => {
    capturedOnVerify = onVerify;
    if (handleRef) handleRef.current = { reset: mockTurnstileReset };
    return <div data-testid="turnstile-widget" />;
  },
}));

async function renderWithSiteKey(
  siteKey: string | undefined,
  props: Parameters<typeof PasswordAuth>[0],
) {
  vi.resetModules();
  if (siteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
  }
  const { PasswordAuth: FreshPasswordAuth } =
    await import("@/components/auth/PasswordAuth");
  return render(<FreshPasswordAuth {...props} />);
}

function verifyCaptcha() {
  act(() => {
    capturedOnVerify?.("captcha-token-abc");
  });
}

describe("PasswordAuth", () => {
  const mockSignUpWithPassword = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const onSwitchToSignIn = vi.fn();
  const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnVerify = null;
    vi.mocked(useAuth).mockReturnValue({
      signUpWithPassword: mockSignUpWithPassword,
      signInWithPassword: mockSignInWithPassword,
    } as unknown as ReturnType<typeof useAuth>);
    mockSignUpWithPassword.mockResolvedValue({ error: null });
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
    }
  });

  it("shows pre-submit feedback once the password is non-empty but under 8 characters", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });

    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
  });

  it("keeps submit disabled until the captcha verifies, then calls signUpWithPassword with the right args", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    });

    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();

    verifyCaptcha();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(mockSignUpWithPassword).toHaveBeenCalledWith(
        "new@user.com",
        "hunter22",
        "captcha-token-abc",
      ),
    );
    expect(mockTurnstileReset).toHaveBeenCalled();
  });

  it("calls signInWithPassword (not signUpWithPassword) in sign-in mode", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-in",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    });
    verifyCaptcha();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        "real@user.com",
        "hunter22",
        "captcha-token-abc",
      ),
    );
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it("renders one generic error for an incorrect password, verbatim from the auth client", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    await renderWithSiteKey("test-site-key", {
      mode: "sign-in",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpass" },
    });
    verifyCaptcha();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid login credentials",
    );
    // The captcha token is single-use — a failed attempt must reset it too,
    // not just a successful one.
    expect(mockTurnstileReset).toHaveBeenCalled();
  });

  it("renders the same collision confirmation screen on sign-up success, regardless of whether the account already existed", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "maybe-existing@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    });
    verifyCaptcha();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    const signInAction = screen.getByRole("button", {
      name: "Sign in instead",
    });
    expect(signInAction).toBeInTheDocument();

    fireEvent.click(signInAction);
    expect(onSwitchToSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not render the widget or block submit when no site key is configured", async () => {
    await renderWithSiteKey(undefined, { mode: "sign-in", onSwitchToSignIn });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    });

    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
