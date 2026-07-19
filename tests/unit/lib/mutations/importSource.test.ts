import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistImportSource } from "@/lib/mutations/importSource";

// In-memory IndexedDB stand-in for the guest path.
const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
}));

const insert = vi.fn().mockResolvedValue({ error: null });
const mockSupabase = {
  from: vi.fn(() => ({ insert })),
  auth: {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }),
  },
};
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

const payload = {
  source_app: "uhabits",
  file_name: "Loop Backup.db",
  raw: { habits: [{ id: 1 }], repetitions: [{ habit: 1, value: 2 }] },
};

beforeEach(() => {
  idbStore.clear();
  insert.mockClear();
  mockSupabase.from.mockClear();
});

describe("persistImportSource — guest", () => {
  it("appends the raw source to the IndexedDB list without touching Supabase", async () => {
    await persistImportSource(payload, { isGuest: true });
    await persistImportSource(
      { ...payload, file_name: "Second.db" },
      {
        isGuest: true,
      },
    );

    const stored = idbStore.get("kanso_import_sources") as Array<{
      file_name: string;
      raw: unknown;
    }>;
    expect(stored).toHaveLength(2);
    expect(stored[0].file_name).toBe("Loop Backup.db");
    expect(stored[1].file_name).toBe("Second.db");
    expect(stored[0].raw).toEqual(payload.raw);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("persistImportSource — registered", () => {
  it("inserts one habit_imports row scoped to the user", async () => {
    await persistImportSource(payload, { isGuest: false });

    expect(mockSupabase.from).toHaveBeenCalledWith("habit_imports");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      source_app: "uhabits",
      file_name: "Loop Backup.db",
      raw: payload.raw,
    });
    expect(idbStore.size).toBe(0);
  });
});
