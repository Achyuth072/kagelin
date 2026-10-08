import { describe, it, expect, vi, beforeEach } from "vitest";

const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  update: vi.fn(async (key: string, updater: (old: unknown) => unknown) => {
    idbStore.set(key, updater(idbStore.get(key)));
  }),
}));

import { keyChainMark } from "@/lib/crypto/keyChainMark";

describe("keyChainMark", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("starts with nothing seen", async () => {
    expect(await keyChainMark.load("user-1")).toEqual({
      keyId: 0,
      sealedV2: false,
      retiredClearedAt: 0,
    });
  });

  it("records the key id at which the retired keys were seen cleared, and never lowers it", async () => {
    await keyChainMark.raise("user-1", { current_key_id: 2, retired_keys: {} });
    await keyChainMark.raise("user-1", {
      current_key_id: 3,
      retired_keys: { "2": "wrapped" },
    });
    await keyChainMark.raise("user-1", { current_key_id: 1, retired_keys: {} });

    expect((await keyChainMark.load("user-1")).retiredClearedAt).toBe(2);
  });

  it("does not treat a row without retired_keys as cleared", async () => {
    await keyChainMark.raise("user-1", { current_key_id: 2 });
    expect((await keyChainMark.load("user-1")).retiredClearedAt).toBe(0);
  });

  it("reads a mark stored before retiredClearedAt existed as nothing cleared", async () => {
    idbStore.set("kagelin-key-chain-mark:user-1", {
      keyId: 2,
      sealedV2: true,
    });
    expect((await keyChainMark.load("user-1")).retiredClearedAt).toBe(0);
    await keyChainMark.raise("user-1", { current_key_id: 2 });
    expect((await keyChainMark.load("user-1")).retiredClearedAt).toBe(0);
  });

  it("never lowers the key id or clears the Re-seal marker", async () => {
    await keyChainMark.raise("user-1", {
      current_key_id: 2,
      sealed_v2_at: "2026-10-08T00:00:00Z",
    });
    await keyChainMark.raise("user-1", {
      current_key_id: 1,
      sealed_v2_at: null,
    });

    expect(await keyChainMark.load("user-1")).toMatchObject({
      keyId: 2,
      sealedV2: true,
    });
  });

  it("reads a row without current_key_id as key id 1", async () => {
    await keyChainMark.raise("user-1", {});
    expect((await keyChainMark.load("user-1")).keyId).toBe(1);
  });

  it("keeps each user's mark separate", async () => {
    await keyChainMark.raise("user-1", { current_key_id: 2 });
    expect((await keyChainMark.load("user-2")).keyId).toBe(0);
  });
});
