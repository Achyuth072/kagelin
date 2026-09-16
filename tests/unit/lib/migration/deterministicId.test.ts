import { describe, it, expect } from "vitest";
import { deriveMigrationId } from "@/lib/migration/deterministicId";

describe("deriveMigrationId", () => {
  it("derives the same id for the same input every time", async () => {
    const a = await deriveMigrationId("guest-task-1");
    const b = await deriveMigrationId("guest-task-1");
    expect(a).toBe(b);
  });

  it("derives different ids for different input", async () => {
    const a = await deriveMigrationId("guest-task-1");
    const b = await deriveMigrationId("guest-task-2");
    expect(a).not.toBe(b);
  });

  it("returns a well-formed UUID (v5, variant 10)", async () => {
    const id = await deriveMigrationId("guest-task-1");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("matches Python's stdlib uuid5 for a known input (RFC 4122 correctness)", async () => {
    // Reference: python -c "import uuid; print(uuid.uuid5(uuid.UUID('6d3f2b0a-6a41-5f2f-9c3a-8e1f6b6d9a2b'), 'test-vector-1'))"
    const id = await deriveMigrationId("test-vector-1");
    expect(id).toBe("c9d00157-a788-5273-8475-8c3d6e95cbf6");
  });
});
