import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OAuthProviderRow } from "@/components/auth/OAuthProviderRow";
import { useAuth } from "@/components/AuthProvider";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

describe("OAuthProviderRow", () => {
  const mockSignInWithOAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      signInWithOAuth: mockSignInWithOAuth,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders Google, GitHub and GitLab as a three-up row", () => {
    render(<OAuthProviderRow />);
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GitLab" })).toBeInTheDocument();
  });

  it.each([
    ["Google", "google"],
    ["GitHub", "github"],
    ["GitLab", "gitlab"],
  ] as const)(
    "calls signInWithOAuth with the matching Provider id for %s",
    (label, providerId) => {
      render(<OAuthProviderRow />);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(providerId);
    },
  );
});
