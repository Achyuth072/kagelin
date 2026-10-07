import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resealUntilClean,
  UnreadableContentError,
} from "@/lib/crypto/resealUntilClean";
import { runReseal } from "@/lib/crypto/reseal";
import { keyStore } from "@/lib/crypto/keyStore";
import { markResealComplete } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/reseal", () => ({
  runReseal: vi.fn(),
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: { loadKeyring: vi.fn() },
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  markResealComplete: vi.fn(),
}));

const USER_ID = "user-1";
const clean = { unreadable: [], sealed: 0 };

describe("resealUntilClean", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(markResealComplete).mockResolvedValue(true);
    vi.mocked(runReseal).mockResolvedValue(clean);
    vi.mocked(keyStore.loadKeyring).mockResolvedValue({
      keyId: "2",
      key: new Uint8Array(32),
      retired: {},
    });
  });

  it("sets the marker under the key id the pass ran with once nothing is left", async () => {
    await resealUntilClean(USER_ID, vi.fn(), new AbortController().signal);

    expect(markResealComplete).toHaveBeenCalledWith(USER_ID, "2");
  });

  it("confirms with another pass after one that wrote something", async () => {
    vi.mocked(runReseal)
      .mockResolvedValueOnce({ unreadable: [], sealed: 3 })
      .mockResolvedValue(clean);

    await resealUntilClean(USER_ID, vi.fn(), new AbortController().signal);

    expect(runReseal).toHaveBeenCalledTimes(2);
    expect(markResealComplete).toHaveBeenCalledTimes(1);
  });

  it("does not set the marker while every pass still finds work", async () => {
    vi.mocked(runReseal).mockResolvedValue({ unreadable: [], sealed: 1 });

    await expect(
      resealUntilClean(USER_ID, vi.fn(), new AbortController().signal),
    ).rejects.toThrow(/still needs upgrading/);
    expect(markResealComplete).not.toHaveBeenCalled();
  });

  it("picks up a conflicting edit on a later pass", async () => {
    vi.mocked(runReseal)
      .mockRejectedValueOnce(new Error("Re-seal conflict: tasks row t1"))
      .mockResolvedValue(clean);

    await resealUntilClean(USER_ID, vi.fn(), new AbortController().signal);

    expect(runReseal).toHaveBeenCalledTimes(2);
    expect(markResealComplete).toHaveBeenCalled();
  });

  it("reports why it stopped, not an earlier conflict a later pass got past", async () => {
    vi.mocked(runReseal)
      .mockRejectedValueOnce(new Error("Re-seal conflict: notification n1"))
      .mockResolvedValue({ unreadable: [], sealed: 1 });

    await expect(
      resealUntilClean(USER_ID, vi.fn(), new AbortController().signal),
    ).rejects.toThrow(/still needs upgrading/);
  });

  it("stops at the first clean pass that leaves only unreadable values, keeping the retired key", async () => {
    const unreadable = [{ table: "tasks", id: "t1", column: "content" }];
    vi.mocked(runReseal).mockResolvedValue({ unreadable, sealed: 0 });

    const error = await resealUntilClean(
      USER_ID,
      vi.fn(),
      new AbortController().signal,
    ).catch((e) => e);

    expect(error).toBeInstanceOf(UnreadableContentError);
    expect(error.values).toEqual(unreadable);
    expect(error.message).toMatch(/tasks\.content of row t1/);
    expect(runReseal).toHaveBeenCalledTimes(1);
    expect(markResealComplete).not.toHaveBeenCalled();
  });

  it("stops between passes once cancelled, without setting the marker", async () => {
    const controller = new AbortController();
    vi.mocked(runReseal).mockImplementation(async () => {
      controller.abort();
      return { unreadable: [], sealed: 1 };
    });

    await expect(
      resealUntilClean(USER_ID, vi.fn(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(runReseal).toHaveBeenCalledTimes(1);
    expect(runReseal).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
      controller.signal,
    );
    expect(markResealComplete).not.toHaveBeenCalled();
  });

  it("fails instead of reporting success when the key rotated under the pass", async () => {
    vi.mocked(markResealComplete).mockResolvedValue(false);

    await expect(
      resealUntilClean(USER_ID, vi.fn(), new AbortController().signal),
    ).rejects.toThrow(/key changed during the Re-seal/);
  });
});
