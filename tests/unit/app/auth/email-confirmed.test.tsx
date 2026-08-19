import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EmailConfirmedPage from "@/../app/auth/email-confirmed/page";
import { trackTelemetry } from "@/lib/telemetry/client";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

describe("EmailConfirmedPage (Finding 3: no auto sign-in after signup confirmation)", () => {
  it("shows a confirmation message, tracks telemetry, and sends the user to sign in", () => {
    render(<EmailConfirmedPage />);

    expect(trackTelemetry).toHaveBeenCalledWith("signup_completed");
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
