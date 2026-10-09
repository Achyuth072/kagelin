import { act, render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { ResealIndicator } from "@/components/encryption/ResealIndicator";
import { notify } from "@/lib/notify";
import {
  resealUntilClean,
  UnreadableContentError,
} from "@/lib/crypto/resealUntilClean";

vi.mock("@/lib/crypto/resealUntilClean", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/crypto/resealUntilClean")>()),
  resealUntilClean: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/notify", () => ({
  notify: Object.assign(vi.fn(), { loading: vi.fn(), dismiss: vi.fn() }),
}));

describe("ResealIndicator", () => {
  beforeEach(() => {
    vi.mocked(resealUntilClean).mockReset();
    vi.mocked(Sentry.captureException).mockReset();
    vi.mocked(notify).mockReset();
    vi.mocked(notify.loading).mockReset();
    vi.mocked(notify.dismiss).mockReset();
  });

  it("shows progress, then reports completion", async () => {
    vi.mocked(resealUntilClean).mockImplementation(
      async (_userId, onProgress) => {
        onProgress({ done: 2, total: 5, table: "tasks" });
      },
    );
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    expect(notify.loading).toHaveBeenCalledWith(
      "Upgrading encryption — 2 of 5",
      { id: "reseal", dismissible: false },
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(notify.dismiss).toHaveBeenCalledWith("reseal");
  });

  it("reports a failed pass and offers a retry", async () => {
    const error = new Error("offline");
    vi.mocked(resealUntilClean).mockRejectedValueOnce(error);
    const onComplete = vi.fn();

    render(<ResealIndicator userId="user-1" onComplete={onComplete} />);

    await waitFor(() => expect(notify).toHaveBeenCalled());
    const [, options] = vi.mocked(notify).mock.lastCall ?? [];
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(onComplete).not.toHaveBeenCalled();
    expect(options?.action?.label).toBe("Retry");

    vi.mocked(resealUntilClean).mockResolvedValue(undefined);
    act(() => void options?.action?.onClick());
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("cancels its run when it unmounts, without completing or reporting", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(resealUntilClean).mockImplementation(
      (_userId, _onProgress, runSignal) =>
        new Promise((_resolve, reject) => {
          signal = runSignal;
          runSignal.addEventListener("abort", () => reject(runSignal.reason));
        }),
    );
    const onComplete = vi.fn();

    const { unmount } = render(
      <ResealIndicator userId="user-1" onComplete={onComplete} />,
    );
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal!.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onComplete).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(notify.dismiss).toHaveBeenCalledWith("reseal");
  });

  it("names the place of each value it can't read", async () => {
    vi.mocked(resealUntilClean).mockRejectedValue(
      new UnreadableContentError([
        { table: "tasks", id: "t1", column: "content" },
      ]),
    );

    render(<ResealIndicator userId="user-1" onComplete={vi.fn()} />);

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(vi.mocked(notify).mock.lastCall?.[0]).toMatch(
      /1 item can't be read \(tasks\.content\)/,
    );
  });
});
