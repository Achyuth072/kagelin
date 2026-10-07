import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResealIndicator } from "@/components/encryption/ResealIndicator";
import {
  findPendingRows,
  runBackfillMigration,
} from "@/lib/crypto/backfillMigration";
import { markResealComplete } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/backfillMigration", () => ({
  runBackfillMigration: vi.fn(),
  findPendingRows: vi.fn(),
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  markResealComplete: vi.fn(),
}));

describe("ResealIndicator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(markResealComplete).mockResolvedValue(undefined);
  });

  it("shows progress, sets the marker once nothing is left, then reports completion", async () => {
    vi.mocked(runBackfillMigration).mockImplementation(
      async (_userId, onProgress) => {
        onProgress?.({ done: 2, total: 5, table: "tasks" });
      },
    );
    vi.mocked(findPendingRows).mockResolvedValue([]);
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /Upgrading encryption/,
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(markResealComplete).toHaveBeenCalledWith("user-1");
  });

  it("does not set the marker while an unupgraded value remains", async () => {
    vi.mocked(runBackfillMigration).mockResolvedValue(undefined);
    vi.mocked(findPendingRows).mockResolvedValue([
      { table: "tasks", id: "t1", updatedAt: null, row: {} },
    ]);
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    await screen.findByRole("button", { name: "Retry" });
    expect(markResealComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("picks up a conflicting edit on a second pass without surfacing an error", async () => {
    vi.mocked(runBackfillMigration)
      .mockRejectedValueOnce(new Error("Migration conflict: tasks row t1"))
      .mockResolvedValue(undefined);
    vi.mocked(findPendingRows).mockResolvedValue([]);
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(runBackfillMigration).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the pass keeps failing", async () => {
    vi.mocked(runBackfillMigration).mockRejectedValue(new Error("offline"));

    render(<ResealIndicator userId="user-1" onComplete={vi.fn()} />);

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(markResealComplete).not.toHaveBeenCalled();

    vi.mocked(runBackfillMigration).mockResolvedValue(undefined);
    vi.mocked(findPendingRows).mockResolvedValue([]);
    fireEvent.click(retry);
    await waitFor(() => expect(markResealComplete).toHaveBeenCalled());
  });
});
