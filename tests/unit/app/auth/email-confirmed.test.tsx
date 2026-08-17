import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EmailConfirmedPage from "@/../app/auth/email-confirmed/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("EmailConfirmedPage (Finding 3: no auto sign-in after signup confirmation)", () => {
  it("shows a confirmation message and sends the user to sign in", () => {
    render(<EmailConfirmedPage />);

    expect(screen.getByText("Email confirmed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
