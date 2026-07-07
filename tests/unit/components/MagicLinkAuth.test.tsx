import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read into a module-level const in
// MagicLinkAuth.tsx (matching how Next.js inlines NEXT_PUBLIC_* at build
// time) — so each test that needs a different value must reset the module
// registry and re-import, not just mutate process.env after import.
async function renderWithSiteKey(siteKey: string | undefined) {
  vi.resetModules();
  if (siteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
  }
  const { MagicLinkAuth } = await import("@/components/auth/MagicLinkAuth");
  return render(<MagicLinkAuth />);
}

describe("MagicLinkAuth (Turnstile wiring)", () => {
  const mockSignInWithMagicLink = vi.fn();
  const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnVerify = null;
    vi.mocked(useAuth).mockReturnValue({
      signInWithMagicLink: mockSignInWithMagicLink,
    } as unknown as ReturnType<typeof useAuth>);
    mockSignInWithMagicLink.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
    }
  });

  it("keeps submit disabled until the Turnstile widget verifies", async () => {
    await renderWithSiteKey("test-site-key");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    capturedOnVerify?.("captcha-token-abc");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    );
  });

  it("passes the captcha token through to signInWithMagicLink and resets after submit", async () => {
    await renderWithSiteKey("test-site-key");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    capturedOnVerify?.("captcha-token-abc");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
        "user@example.com",
        "captcha-token-abc",
      ),
    );
    expect(mockTurnstileReset).toHaveBeenCalled();
  });

  it("does not render the widget or block submit when no site key is configured", async () => {
    await renderWithSiteKey(undefined);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });

    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
