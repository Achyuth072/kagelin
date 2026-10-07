import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resealUntilClean,
  UnreadableContentError,
} from "@/lib/crypto/resealUntilClean";
import {
  findPendingQueueRows,
  findPendingRows,
  runReseal,
} from "@/lib/crypto/reseal";
import { keyStore } from "@/lib/crypto/keyStore";
import { markResealComplete } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/reseal", () => ({
  runReseal: vi.fn(),
  findPendingRows: vi.fn(),
  findPendingQueueRows: vi.fn(),
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: { loadKeyring: vi.fn() },
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  markResealComplete: vi.fn(),
}));

const USER_ID = "user-1";

describe("resealUntilClean", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(markResealComplete).mockResolvedValue(undefined);
    vi.mocked(runReseal).mockResolvedValue([]);
    vi.mocked(findPendingRows).mockResolvedValue([]);
    vi.mocked(findPendingQueueRows).mockResolvedValue([]);
    vi.mocked(keyStore.loadKeyring).mockResolvedValue({
      keyId: "2",
      key: new Uint8Array(32),
      retired: {},
    });
  });

  it("sets the marker under the key id the pass ran with once nothing is left", async () => {
    await resealUntilClean(USER_ID, vi.fn());

    expect(markResealComplete).toHaveBeenCalledWith(USER_ID, "2");
    expect(findPendingQueueRows).toHaveBeenCalledWith(USER_ID, "2");
  });

  it("does not set the marker while an unupgraded value remains", async () => {
    vi.mocked(findPendingRows).mockResolvedValue([
      { table: "tasks", id: "t1", updatedAt: null, row: {} },
    ]);

    await expect(resealUntilClean(USER_ID, vi.fn())).rejects.toThrow(
      /still needs upgrading/,
    );
    expect(markResealComplete).not.toHaveBeenCalled();
  });

  it("picks up a conflicting edit on a second pass", async () => {
    vi.mocked(runReseal)
      .mockRejectedValueOnce(new Error("Re-seal conflict: tasks row t1"))
      .mockResolvedValue([]);

    await resealUntilClean(USER_ID, vi.fn());

    expect(runReseal).toHaveBeenCalledTimes(2);
    expect(markResealComplete).toHaveBeenCalled();
  });

  it("stops at the first clean pass that leaves only unreadable values, keeping the retired key", async () => {
    const unreadable = [{ table: "tasks", id: "t1", column: "content" }];
    vi.mocked(runReseal).mockResolvedValue(unreadable);
    vi.mocked(findPendingRows).mockResolvedValue([
      { table: "tasks", id: "t1", updatedAt: null, row: {} },
    ]);

    const error = await resealUntilClean(USER_ID, vi.fn()).catch((e) => e);

    expect(error).toBeInstanceOf(UnreadableContentError);
    expect(error.values).toEqual(unreadable);
    expect(error.message).toMatch(/tasks\.content of row t1/);
    expect(runReseal).toHaveBeenCalledTimes(1);
    expect(markResealComplete).not.toHaveBeenCalled();
  });
});
