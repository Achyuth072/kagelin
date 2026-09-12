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

import { migrationSnapshot } from "@/lib/migration/snapshot";
import type { GuestData } from "@/lib/mock/mock-store";

const data = { tasks: [{ id: "t1" }] } as unknown as GuestData;

describe("migrationSnapshot", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("returns null when nothing was saved", async () => {
    expect(await migrationSnapshot.load("user-a")).toBeNull();
  });

  it("round-trips a saved snapshot", async () => {
    await migrationSnapshot.save("user-a", data);
    expect(await migrationSnapshot.load("user-a")).toEqual(data);
  });

  it("returns null again after clear", async () => {
    await migrationSnapshot.save("user-a", data);
    await migrationSnapshot.clear();
    expect(await migrationSnapshot.load("user-a")).toBeNull();
  });

  it("refuses another account's snapshot, and discards it", async () => {
    await migrationSnapshot.save("user-a", data);
    expect(await migrationSnapshot.load("user-b")).toBeNull();
    expect(await migrationSnapshot.load("user-a")).toBeNull();
  });

  it("discards an unowned snapshot written by a pre-binding release", async () => {
    idbStore.set("kanso-guest-migration-snapshot", data);
    expect(await migrationSnapshot.load("user-a")).toBeNull();
    expect(idbStore.has("kanso-guest-migration-snapshot")).toBe(false);
  });
});
