import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_KEY } from "@/lib/mock/mock-store";
import type { User } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackSignupCompleted: vi.fn(),
}));

import { trackSignupCompleted } from "@/lib/telemetry/client";

type MockSupabaseBuilder = Promise<{ data: unknown; error: unknown }> & {
  from: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  eq: Mock;
  single: Mock;
};

describe("useMigrationStrategy", () => {
  let mockSupabase: MockSupabaseBuilder;
  const mockUser = { id: "real-user-id" } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("location", { reload: vi.fn() });

    // Helper to create a promise that also has chainable methods
    const createMockBuilder = (data: unknown = [], error: unknown = null) => {
      const promise = Promise.resolve({ data, error });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(() => builder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase = createMockBuilder();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>,
    );
  });

  const setupMockSequence = (
    results: { data: unknown; error?: unknown; count?: number }[],
  ) => {
    let index = 0;
    const createBuilder = () => {
      const result = results[index++] || { data: [], error: null };
      const promise = Promise.resolve({
        data: result.data,
        error: result.error || null,
        count: result.count ?? 0,
      });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(createBuilder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase.from.mockImplementation(createBuilder);
  };

  const mockAuthAsRealUser = () =>
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

  it("MIG-E-01: Skipping migration for existing users", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
      }),
    );
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    // Only the Inbox exists, but existing tasks still mark this account established.
    setupMockSequence([
      { data: [{ id: "inbox", is_inbox: true }] },
      { data: [], count: 12 }, // existing task count
      { data: [], count: 0 }, // existing habit count
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      },
      { timeout: 3000 },
    );

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("MIG-E-02: Skipping migration for an account with manual projects but no tasks/habits yet", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
        events: [],
        seed_ids: [],
      }),
    );
    mockAuthAsRealUser();

    setupMockSequence([
      {
        data: [
          { id: "inbox", is_inbox: true },
          { id: "p1", is_inbox: false },
        ],
      },
      { data: [], count: 0 }, // existing task count
      { data: [], count: 0 }, // existing habit count
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      },
      { timeout: 3000 },
    );

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("MIG-N-01: Successful migration flow", async () => {
    const guestData = {
      tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
      projects: [{ id: "g-p1", name: "Work", is_inbox: false }],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    setupMockSequence([
      { data: [] }, // Initial project check
      { data: { id: "s-p1" } }, // Project insert
      { data: [{ id: "s-t1", content: "Task 1", created_at: "2023-01-01" }] }, // Task insert
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
  });

  it("MIG-B-01: Correct parent_id mapping for subtasks", async () => {
    const guestTasks = [
      {
        id: "parent",
        content: "Parent",
        parent_id: null,
        created_at: "2023-01-01",
      },
      {
        id: "child",
        content: "Child",
        parent_id: "parent",
        created_at: "2023-01-02",
      },
    ];
    const guestData = {
      tasks: guestTasks,
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    setupMockSequence([
      { data: [] }, // Initial check
      {
        data: [
          { id: "new-parent", content: "Parent", created_at: "2023-01-01" },
          { id: "new-child", content: "Child", created_at: "2023-01-02" },
        ],
      }, // Task insert
      { data: {} }, // Task update
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
        expect(trackSignupCompleted).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  // See docs/adr/0014-demo-data-stripped-on-signup-migration.md.
  it("MIG-D-01: does not migrate Demo items", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [
          { id: "demo-t1", content: "Demo task", created_at: "2023-01-01" },
          { id: "own-t1", content: "My task", created_at: "2023-01-02" },
        ],
        projects: [{ id: "demo-p1", name: "Work", is_inbox: false }],
        habits: [{ id: "demo-h1", name: "Meditate" }],
        habit_entries: [{ habit_id: "demo-h1", date: "2023-01-01", value: 1 }],
        focus_logs: [
          { task_id: "demo-t1", duration_seconds: 3600 },
          { task_id: "own-t1", duration_seconds: 600 },
        ],
        events: [],
        seed_ids: ["demo-t1", "demo-p1", "demo-h1"],
      }),
    );
    mockAuthAsRealUser();

    setupMockSequence([
      { data: [] }, // existing projects (for dedupe)
      { data: [], count: 0 }, // existing task count
      { data: [], count: 0 }, // existing habit count
      { data: [{ id: "s-t1", content: "My task", created_at: "2023-01-02" }] }, // task insert
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );

    const inserted = mockSupabase.from.mock.results.flatMap((r) =>
      (r.value as MockSupabaseBuilder).insert.mock.calls.flat(),
    );

    expect(JSON.stringify(inserted)).not.toContain("Demo task");
    expect(JSON.stringify(inserted)).not.toContain("Meditate");
    expect(JSON.stringify(inserted)).not.toContain("Work");
    expect(JSON.stringify(inserted)).not.toContain("3600");
    expect(JSON.stringify(inserted)).toContain("My task");
  });
});
