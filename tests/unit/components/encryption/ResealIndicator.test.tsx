import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { ResealIndicator } from "@/components/encryption/ResealIndicator";
import {
  resealUntilClean,
  UnreadableContentError,
} from "@/lib/crypto/resealUntilClean";

vi.mock("@/lib/crypto/resealUntilClean", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/crypto/resealUntilClean")>()),
  resealUntilClean: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("ResealIndicator", () => {
  beforeEach(() => {
    vi.mocked(resealUntilClean).mockReset();
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("shows progress, then reports completion", async () => {
    vi.mocked(resealUntilClean).mockImplementation(
      async (_userId, onProgress) => {
        onProgress({ done: 2, total: 5, table: "tasks" });
      },
    );
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /Upgrading encryption/,
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("reports a failed pass and offers a retry", async () => {
    const error = new Error("offline");
    vi.mocked(resealUntilClean).mockRejectedValueOnce(error);
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(onComplete).not.toHaveBeenCalled();

    vi.mocked(resealUntilClean).mockResolvedValue(undefined);
    fireEvent.click(retry);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("names the place of each value it can't read", async () => {
    vi.mocked(resealUntilClean).mockRejectedValue(
      new UnreadableContentError([
        { table: "tasks", id: "t1", column: "content" },
      ]),
    );

    render(<ResealIndicator userId="user-1" onComplete={vi.fn()} />);

    expect(
      await screen.findByText(/1 item can't be read \(tasks\.content\)/),
    ).toBeInTheDocument();
  });
});
