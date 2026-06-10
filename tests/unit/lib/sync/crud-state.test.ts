import { describe, it, expect } from "vitest";
import { applyCrudTransition } from "@/lib/sync/crud-state";

describe("applyCrudTransition", () => {
  it("clean event + edit → pending_update", () => {
    const result = applyCrudTransition(null, "edit");
    expect(result).toEqual({ newState: "pending_update", hardDelete: false });
  });

  it("clean event + delete → pending_delete tombstone", () => {
    const result = applyCrudTransition(null, "delete");
    expect(result).toEqual({ newState: "pending_delete", hardDelete: false });
  });

  it("pending_create + edit → stays pending_create", () => {
    const result = applyCrudTransition("pending_create", "edit");
    expect(result).toEqual({ newState: "pending_create", hardDelete: false });
  });

  it("pending_create + delete → hard-delete, no remote call needed", () => {
    const result = applyCrudTransition("pending_create", "delete");
    expect(result).toEqual({ newState: null, hardDelete: true });
  });

  it("pending_update + delete → pending_delete supersedes", () => {
    const result = applyCrudTransition("pending_update", "delete");
    expect(result).toEqual({ newState: "pending_delete", hardDelete: false });
  });
});
