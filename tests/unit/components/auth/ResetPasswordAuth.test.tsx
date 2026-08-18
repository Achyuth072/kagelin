import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "@/components/AuthProvider";

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

async function renderResetPasswordAuth(
  onBackToSignIn: () => void,
  siteKey: string | undefined,
) {
  vi.resetModules();
  if (siteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
  }
  const { ResetPasswordAuth } =
    await import("@/components/auth/ResetPasswordAuth");
  return render(<ResetPasswordAuth onBackToSignIn={onBackToSignIn} />);
}

function verifyCaptcha() {
  act(() => {
    capturedOnVerify?.("captcha-token-abc");
  });
}

async function submitRequest(email: string) {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: email },
  });
  verifyCaptcha();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
}

describe("ResetPasswordAuth", () => {
  const mockResetPasswordForEmail = vi.fn();
  const onBackToSignIn = vi.fn();
  const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnVerify = null;
    vi.mocked(useAuth).mockReturnValue({
      resetPasswordForEmail: mockResetPasswordForEmail,
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    cleanup();
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
    }
  });

  it("renders the same confirmation whether resetPasswordForEmail succeeds", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await renderResetPasswordAuth(onBackToSignIn, "test-site-key");

    await submitRequest("real@user.com");

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "real@user.com",
      "captcha-token-abc",
    );
    expect(mockTurnstileReset).toHaveBeenCalled();
  });

  it("renders the identical confirmation when resetPasswordForEmail returns an error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "Something went wrong" },
    });
    await renderResetPasswordAuth(onBackToSignIn, "test-site-key");

    await submitRequest("unknown@user.com");

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("offers a support contact on the confirmation screen for a reset the owner didn't request", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await renderResetPasswordAuth(onBackToSignIn, "test-site-key");

    await submitRequest("real@user.com");
    await screen.findByText("Check your inbox");

    expect(
      screen.getByRole("link", { name: "contact support" }),
    ).toHaveAttribute("href", "mailto:support@kagelin.app");
  });

  it("returns to sign-in when the confirmation's back link is clicked", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await renderResetPasswordAuth(onBackToSignIn, "test-site-key");

    await submitRequest("real@user.com");
    await screen.findByText("Check your inbox");

    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
  });

  it("keeps submit disabled until the captcha verifies", async () => {
    await renderResetPasswordAuth(onBackToSignIn, "test-site-key");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@user.com" },
    });
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeDisabled();

    verifyCaptcha();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send reset link" }),
      ).toBeEnabled(),
    );
  });

  it("does not render the widget or block submit when no site key is configured", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await renderResetPasswordAuth(onBackToSignIn, undefined);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@user.com" },
    });

    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("real@user.com", "");
  });
});
