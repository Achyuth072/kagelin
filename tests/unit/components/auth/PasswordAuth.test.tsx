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

const mockIsPasswordBreached = vi.fn();
vi.mock("@/lib/auth/password-breach-check", () => ({
  isPasswordBreached: (...args: unknown[]) => mockIsPasswordBreached(...args),
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
    mockIsPasswordBreached.mockResolvedValue(false);
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
    expect(mockTurnstileReset).toHaveBeenCalled();
  });

  it("translates a signup-disabled error into the friendly private-app message", async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: { message: "Signups not allowed for this instance" },
    });
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
    verifyCaptcha();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This app is private. Only authorized users can sign in.",
    );
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

  it("shows 'Forgot password?' in sign-in mode and calls onForgotPassword when clicked", async () => {
    const onForgotPassword = vi.fn();
    await renderWithSiteKey("test-site-key", {
      mode: "sign-in",
      onSwitchToSignIn,
      onForgotPassword,
    });

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it("does not show 'Forgot password?' in sign-up mode", async () => {
    const onForgotPassword = vi.fn();
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
      onForgotPassword,
    });

    expect(
      screen.queryByRole("button", { name: "Forgot password?" }),
    ).not.toBeInTheDocument();
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

  it("checks for a breached password on blur in sign-up mode and shows an advisory warning", async () => {
    mockIsPasswordBreached.mockResolvedValue(true);
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@user.com" },
    });
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    expect(mockIsPasswordBreached).not.toHaveBeenCalled();

    fireEvent.blur(passwordInput);

    expect(
      await screen.findByText(/appeared in known data breaches/),
    ).toBeInTheDocument();
    expect(mockIsPasswordBreached).toHaveBeenCalledWith("hunter22");
    verifyCaptcha();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
  });

  it("does not check for breach on blur in sign-in mode", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-in",
      onSwitchToSignIn,
    });

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    fireEvent.blur(passwordInput);

    expect(mockIsPasswordBreached).not.toHaveBeenCalled();
  });

  it("ignores a stale breach result that resolves after a newer check has started", async () => {
    let resolveFirst: (breached: boolean) => void = () => {};
    let resolveSecond: (breached: boolean) => void = () => {};
    mockIsPasswordBreached
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSecond = resolve)),
      );

    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    fireEvent.blur(passwordInput);
    fireEvent.change(passwordInput, { target: { value: "hunter2222" } });
    fireEvent.blur(passwordInput);

    expect(mockIsPasswordBreached).toHaveBeenCalledTimes(2);

    resolveSecond(false);
    await waitFor(() =>
      expect(
        screen.queryByText(/appeared in known data breaches/),
      ).not.toBeInTheDocument(),
    );
    resolveFirst(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByText(/appeared in known data breaches/),
    ).not.toBeInTheDocument();
  });

  it("does not re-fire the check on a second blur when the password hasn't changed", async () => {
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    fireEvent.blur(passwordInput);
    fireEvent.blur(passwordInput);

    await waitFor(() =>
      expect(mockIsPasswordBreached).toHaveBeenCalledTimes(1),
    );
  });

  it("clears the breach warning once the password is edited again", async () => {
    mockIsPasswordBreached.mockResolvedValue(true);
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    fireEvent.blur(passwordInput);
    expect(
      await screen.findByText(/appeared in known data breaches/),
    ).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: "hunter222" } });

    expect(
      screen.queryByText(/appeared in known data breaches/),
    ).not.toBeInTheDocument();
  });

  it("never blocks sign-up when the breach check rejects (fails open)", async () => {
    mockIsPasswordBreached.mockRejectedValue(new Error("network error"));
    await renderWithSiteKey("test-site-key", {
      mode: "sign-up",
      onSwitchToSignIn,
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@user.com" },
    });
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "hunter22" } });
    fireEvent.blur(passwordInput);
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
  });
});
