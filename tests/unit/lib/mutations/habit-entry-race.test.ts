import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
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
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => wrapSupabaseClient(backend.raw, FIELD_MAP),
}));

const { habitMutations } = await import("@/lib/mutations/habit");

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  localStorage.removeItem("kanso_guest_mode");
});

describe("habitMutations.markComplete when another device saves the same day first", () => {
  it("retries under the stored id, so the notes stay readable", async () => {
    let upserts = 0;
    backend.raw = createFakeSupabaseClient(
      { habits: [{ id: "h1", user_id: "user-1" }] },
      {
        // Simulates concurrent insert landing between lookup and upsert.
        failWrite: ({ table, kind }) => {
          if (table !== "habit_entries" || kind !== "upsert") return null;
          if (upserts++ > 0) return null;
          backend.raw
            .rawRows("habit_entries")
            .push({ id: "other-device", habit_id: "h1", date: "2026-10-08" });
          return {
            message: "habit_entries.id cannot change",
            hint: "habit_entry_id_changed",
          };
        },
      },
    );

    const entry = await habitMutations.markComplete({
      habitId: "h1",
      date: "2026-10-08",
      value: 1,
      notes: "Felt good",
    });

    expect(entry?.id).toBe("other-device");
    expect(entry?.notes).toBe("Felt good");
    expect(backend.raw.rawRows("habit_entries")).toHaveLength(1);
  });
});

describe("habit_entries id guard", () => {
  it("refuses an id change in the schema and its migration, with the hint the client retries on", async () => {
    const { readFileSync } = await import("fs");
    for (const file of [
      "supabase/schema.sql",
      "supabase/migrations/20261008120400_habit_entry_id_cannot_change.sql",
    ]) {
      const sql = readFileSync(file, "utf-8");
      expect(sql).toContain("IF NEW.id IS DISTINCT FROM OLD.id THEN");
      expect(sql).toContain("HINT = 'habit_entry_id_changed'");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.habit_entries\s+FOR EACH ROW EXECUTE FUNCTION public\.keep_habit_entry_id\(\)/,
      );
    }
  });
});
