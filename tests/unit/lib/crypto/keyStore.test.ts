import { describe, it, expect, vi, beforeEach } from "vitest";

const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
}));

import { keyStore } from "@/lib/crypto/keyStore";

describe("keyStore", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("returns null when nothing has been saved", async () => {
    expect(await keyStore.load()).toBeNull();
  });

  it("round-trips a saved key through load", async () => {
    const key = new Uint8Array([1, 2, 3, 4]);
    await keyStore.save("user-a", key);
    expect(await keyStore.load("user-a")).toEqual(key);
  });

  it("clear removes the saved key", async () => {
    await keyStore.save("user-a", new Uint8Array([1, 2, 3]));
    await keyStore.clear();
    expect(await keyStore.load()).toBeNull();
  });

  it("stores the key under IndexedDB via idb-keyval, not localStorage", async () => {
    const { set } = await import("idb-keyval");
    await keyStore.save("user-a", new Uint8Array([9]));
    expect(set).toHaveBeenCalled();
  });

  it("refuses a key belonging to another account, and evicts it", async () => {
    await keyStore.save("user-a", new Uint8Array([1, 2, 3]));
    expect(await keyStore.load("user-b")).toBeNull();
    // Mismatch evicts the key so subsequent reads return null.
    expect(await keyStore.load("user-a")).toBeNull();
  });

  it("discards an unowned key written by a pre-binding release", async () => {
    idbStore.set("kagelin-master-key", new Uint8Array([1, 2, 3]));
    // Fresh module so the in-memory cache doesn't short-circuit the read.
    vi.resetModules();
    const { keyStore: fresh } = await import("@/lib/crypto/keyStore");
    expect(await fresh.load("user-a")).toBeNull();
    expect(idbStore.has("kagelin-master-key")).toBe(false);
  });
});
