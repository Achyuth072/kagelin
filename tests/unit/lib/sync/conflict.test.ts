import { describe, it, expect } from "vitest";
import { resolveLWW } from "@/lib/sync/conflict";

describe("resolveLWW", () => {
  it("clean synced row (null) → remote always wins", () => {
    expect(
      resolveLWW({
        syncState: null,
        localUpdatedAt: "2026-06-01T12:00:00Z",
        remoteUpdatedAt: "2026-06-01T11:00:00Z",
      }),
    ).toBe("remote");
  });

  it("pending_delete → local wins even when remote is newer (no resurrection)", () => {
    expect(
      resolveLWW({
        syncState: "pending_delete",
        localUpdatedAt: "2026-06-01T11:00:00Z",
        remoteUpdatedAt: "2026-06-01T12:00:00Z",
      }),
    ).toBe("local");
  });

  it("pending_update, local newer → local wins", () => {
    expect(
      resolveLWW({
        syncState: "pending_update",
        localUpdatedAt: "2026-06-01T12:00:01Z",
        remoteUpdatedAt: "2026-06-01T12:00:00Z",
      }),
    ).toBe("local");
  });

  it("pending_update, remote newer → remote wins and clears pending_update", () => {
    expect(
      resolveLWW({
        syncState: "pending_update",
        localUpdatedAt: "2026-06-01T11:59:59Z",
        remoteUpdatedAt: "2026-06-01T12:00:00Z",
      }),
    ).toBe("remote");
  });
});
