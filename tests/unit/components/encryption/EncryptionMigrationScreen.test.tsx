import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionMigrationScreen } from "@/components/encryption/EncryptionMigrationScreen";
import { runReseal } from "@/lib/crypto/reseal";
import { markMigrationComplete } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/reseal", () => ({
  runReseal: vi.fn(),
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  markMigrationComplete: vi.fn(),
}));

describe("EncryptionMigrationScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("runs the backfill, marks it complete, and calls onComplete", async () => {
    vi.mocked(runReseal).mockImplementation(async (_userId, onProgress) => {
      onProgress?.({ done: 1, total: 2, table: "tasks" });
      onProgress?.({ done: 2, total: 2, table: "tasks" });
      return { unreadable: [], sealed: 0 };
    });
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(runReseal).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
      undefined,
    );
    expect(markMigrationComplete).toHaveBeenCalledWith("user-1", true);
  });

  it("marks the account only after a pass that writes nothing, so rows added meanwhile are sealed too", async () => {
    vi.mocked(runReseal)
      .mockResolvedValueOnce({ unreadable: [], sealed: 5 })
      .mockResolvedValueOnce({ unreadable: [], sealed: 1 })
      .mockResolvedValue({ unreadable: [], sealed: 0 });
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(runReseal).toHaveBeenCalledTimes(3);
    expect(markMigrationComplete).toHaveBeenCalledTimes(1);
  });

  it("shows progress while the pass is running, so a slow pass doesn't look like a hang", async () => {
    let resolveMigration: () => void = () => {};
    vi.mocked(runReseal).mockImplementation(
      (_userId, onProgress) =>
        new Promise((resolve) => {
          onProgress?.({ done: 3, total: 10, table: "habits" });
          resolveMigration = () => resolve({ unreadable: [], sealed: 0 });
        }),
    );

    render(<EncryptionMigrationScreen userId="user-1" onComplete={vi.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Encrypting habits — 3 of 10/),
      ).toBeInTheDocument(),
    );

    resolveMigration();
  });

  it("shows a retry action and does not mark migration complete when the pass fails", async () => {
    vi.mocked(runReseal).mockRejectedValue(new Error("network dropped"));
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() =>
      expect(screen.getByText("network dropped")).toBeInTheDocument(),
    );
    expect(markMigrationComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    vi.mocked(runReseal).mockResolvedValue({ unreadable: [], sealed: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("lets the user in while a value can't be opened, leaving the Re-seal to report it", async () => {
    vi.mocked(runReseal).mockResolvedValue({
      unreadable: [{ table: "tasks", id: "t1", column: "content" }],
      sealed: 0,
    });
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(markMigrationComplete).toHaveBeenCalledWith("user-1", false);
  });

  it("still calls onComplete under React StrictMode's dev-only double effect invocation", async () => {
    vi.mocked(runReseal).mockResolvedValue({ unreadable: [], sealed: 0 });
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <StrictMode>
        <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />
      </StrictMode>,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
