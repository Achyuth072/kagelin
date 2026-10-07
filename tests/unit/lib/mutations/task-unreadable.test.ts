import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { sealEnvelope, INITIAL_KEY_ID } from "@/lib/crypto/envelope";
import { UNREADABLE_CONTENT_CODE } from "@/lib/crypto/unreadable";
import type { Task } from "@/lib/types/task";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    loadKeyring: vi.fn(async () =>
      keyStoreState.key
        ? { keyId: "1", key: keyStoreState.key, retired: {} }
        : null,
    ),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));
vi.mock("@/lib/telemetry/client", () => ({ trackTelemetry: vi.fn() }));

const backend = { raw: createFakeSupabaseClient() };
function withAuth(client: ReturnType<typeof createFakeSupabaseClient>) {
  client.auth = {
    getSession: async () => ({ data: { session: { user: { id: "user-1" } } } }),
  };
  return client;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => wrapSupabaseClient(withAuth(backend.raw), FIELD_MAP),
}));

const { taskMutations } = await import("@/lib/mutations/task");
const { createClient } = await import("@/lib/supabase/client");

// A title sealed for another row, as if moved into t1 by someone with database access.
async function seedMovedTitle(extra: Record<string, unknown> = {}) {
  const moved = await sealEnvelope(
    keyStoreState.key!,
    new TextEncoder().encode("Someone else's task"),
    INITIAL_KEY_ID,
    { userId: "user-1", table: "tasks", column: "content", rowId: "t9" },
  );
  backend.raw = createFakeSupabaseClient({
    tasks: [{ id: "t1", user_id: "user-1", content: moved, ...extra }],
  });
  const { data } = await createClient()
    .from("tasks")
    .select()
    .eq("id", "t1")
    .single();
  return data as Task;
}

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
});

describe("task mutations on a task with unreadable content", () => {
  it("refuses to duplicate it", async () => {
    const task = await seedMovedTitle();

    await expect(taskMutations.duplicate(task)).rejects.toMatchObject({
      code: UNREADABLE_CONTENT_CODE,
    });
    expect(backend.raw.rawRows("tasks")).toHaveLength(1);
  });

  it("refuses to restore it after a delete", async () => {
    const task = await seedMovedTitle();
    backend.raw = createFakeSupabaseClient();

    await expect(taskMutations.restore(task)).rejects.toMatchObject({
      code: UNREADABLE_CONTENT_CODE,
    });
    expect(backend.raw.rawRows("tasks")).toHaveLength(0);
  });

  it("refuses to complete a recurring one before closing it, so the series keeps its next Occurrence", async () => {
    await seedMovedTitle({
      recurrence: { type: "daily", interval: 1 },
      is_completed: false,
      due_date: "2026-10-07T00:00:00.000Z",
    });

    await expect(
      taskMutations.toggle({ id: "t1", is_completed: true }),
    ).rejects.toMatchObject({ code: UNREADABLE_CONTENT_CODE });
    expect(backend.raw.rawRows("tasks")[0].is_completed).toBe(false);
  });

  it("still completes a one-off task", async () => {
    await seedMovedTitle({ is_completed: false });

    await taskMutations.toggle({ id: "t1", is_completed: true });

    expect(backend.raw.rawRows("tasks")[0].is_completed).toBe(true);
  });
});
