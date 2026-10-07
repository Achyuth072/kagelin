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
    vi.clearAllMocks();
  });

  it("runs the backfill, marks it complete, and calls onComplete", async () => {
    vi.mocked(runReseal).mockImplementation(async (_userId, onProgress) => {
      onProgress?.({ done: 1, total: 2, table: "tasks" });
      onProgress?.({ done: 2, total: 2, table: "tasks" });
      return { unreadable: [], sealed: 2 };
    });
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(runReseal).toHaveBeenCalledWith("user-1", expect.any(Function));
    expect(markMigrationComplete).toHaveBeenCalledWith("user-1");
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

  it("does not mark migration complete while a value can't be opened", async () => {
    vi.mocked(runReseal).mockResolvedValue({
      unreadable: [{ table: "tasks", id: "t1", column: "content" }],
      sealed: 0,
    });
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await screen.findByText(/tasks\.content of row t1/);
    expect(markMigrationComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
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
