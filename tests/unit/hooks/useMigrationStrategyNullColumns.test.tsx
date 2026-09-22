import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_KEY } from "@/lib/mock/mock-store";
import { migrationIntent } from "@/lib/migration/intent";

vi.mock("@/components/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/telemetry/client", () => ({ trackSignupCompleted: vi.fn() }));
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));
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
vi.mock("@/lib/backup/export-import", () => ({
  createBackupZip: vi.fn(async () => new Blob()),
  downloadBackup: vi.fn(),
}));

// PostgREST fills any column named in `?columns=` but absent from a row's JSON
// body with NULL, so a NOT NULL column with a DEFAULT still rejects the row —
// unless the request sends `Prefer: missing=default`.
const NOT_NULL_HABIT_COLUMNS = ["habit_type", "reminder_days"];

function fakePostgrest() {
  const habitErrors: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : (input as Request).url,
    );
    const method = init?.method ?? "GET";
    const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      });

    if (method === "GET" || method === "HEAD") {
      return json([], 200, { "content-range": "*/0" });
    }

    const rows = JSON.parse(String(init?.body ?? "[]")) as Record<
      string,
      unknown
    >[];
    if (url.pathname.endsWith("/habits") && method === "POST") {
      const columns = (url.searchParams.get("columns") ?? "")
        .split(",")
        .map((c) => c.replace(/"/g, ""));
      const missingUsesDefault = (
        new Headers(init?.headers).get("Prefer") ?? ""
      ).includes("missing=default");
      for (const row of rows) {
        for (const col of columns) {
          if (row[col] === undefined && !missingUsesDefault) row[col] = null;
        }
        for (const col of NOT_NULL_HABIT_COLUMNS) {
          if (columns.includes(col) && row[col] === null) {
            const message = `null value in column "${col}" of relation "habits" violates not-null constraint`;
            habitErrors.push(message);
            return json(
              { code: "23502", message, details: null, hint: null },
              400,
            );
          }
        }
      }
    }
    return new Response(null, { status: 201 });
  };
  return { fetchImpl, habitErrors };
}

describe("useMigrationStrategy against PostgREST NULL-fill semantics", () => {
  const mockUser = { id: "real-user-id" } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    idbStore.clear();
    vi.stubGlobal("location", { reload: vi.fn() });
    migrationIntent.record(mockUser.id);
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("migrates a guest habit that predates habit_type without a NOT NULL violation", async () => {
    const { fetchImpl, habitErrors } = fakePostgrest();
    vi.mocked(createClient).mockReturnValue(
      createSupabaseJsClient("http://localhost:54321", "anon-key", {
        global: { fetch: fetchImpl },
      }) as unknown as ReturnType<typeof createClient>,
    );

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [],
        projects: [],
        habits: [{ id: "g-h1", name: "Stretch", start_date: "2023-01-01" }],
        habit_entries: [],
        focus_logs: [],
        events: [],
      }),
    );

    renderHook(() => useMigrationStrategy());

    await waitFor(() => expect(window.location.reload).toHaveBeenCalled(), {
      timeout: 4000,
    });
    expect(habitErrors).toEqual([]);
  });
});
