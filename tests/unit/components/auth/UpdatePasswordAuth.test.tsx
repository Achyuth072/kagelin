import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/components/AuthProvider";
import { UpdatePasswordAuth } from "@/components/auth/UpdatePasswordAuth";
import type { User } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const mockUser = { id: "real-user-id" } as User;

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser,
    loading: false,
    isGuestMode: false,
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

describe("UpdatePasswordAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an expired-link message when there is no recovery session", () => {
    mockAuth({ user: null });
    render(<UpdatePasswordAuth />);

    expect(screen.getByText("Link expired")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("treats a guest session as no recovery session", () => {
    mockAuth({ isGuestMode: true });
    render(<UpdatePasswordAuth />);

    expect(screen.getByText("Link expired")).toBeInTheDocument();
  });

  it("calls updatePassword with the new password and shows a confirmation", async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    mockAuth({ updatePassword });
    render(<UpdatePasswordAuth />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-hunter22" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "new-hunter22" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith("new-hunter22"),
    );
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });

  it("toggles password visibility on both fields independently", () => {
    mockAuth();
    render(<UpdatePasswordAuth />);

    const newPasswordInput = screen.getByLabelText("New password");
    const confirmPasswordInput = screen.getByLabelText("Confirm password");
    expect(newPasswordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(newPasswordInput).toHaveAttribute("type", "text");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });

  it("disables submit and shows an error when the confirmation doesn't match", () => {
    mockAuth();
    render(<UpdatePasswordAuth />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-hunter22" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "new-hunter23" },
    });

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeDisabled();
  });

  it("does not call updatePassword when the confirmation is empty", () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    mockAuth({ updatePassword });
    render(<UpdatePasswordAuth />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-hunter22" },
    });

    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeDisabled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("renders the error returned by updatePassword", async () => {
    const updatePassword = vi
      .fn()
      .mockResolvedValue({ error: { message: "Session expired" } });
    mockAuth({ updatePassword });
    render(<UpdatePasswordAuth />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-hunter22" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "new-hunter22" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session expired",
    );
  });

  it("disables submit while the password is under 8 characters", () => {
    mockAuth();
    render(<UpdatePasswordAuth />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });

    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeDisabled();
  });
});
