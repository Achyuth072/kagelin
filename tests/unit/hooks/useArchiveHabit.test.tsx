/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useArchiveHabit,
  useUnarchiveHabit,
} from "@/lib/hooks/useHabitMutations";
import { mockStore } from "@/lib/mock/mock-store";
import type { HabitWithEntries } from "@/lib/types/habit";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/telemetry/client", () => ({ trackTelemetry: vi.fn() }));

const habit = (id: string, archived_at: string | null, sort_order: number) =>
  ({ id, archived_at, sort_order, entries: [] }) as unknown as HabitWithEntries;

const key = (includeArchived: boolean, isGuestMode: boolean) => [
  "habits",
  { includeArchived, isGuestMode },
];

describe("archive / unarchive habit", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const run = async (hook: () => any, id: string) => {
    const { result } = renderHook(hook, { wrapper });
    await act(async () => {
      await result.current.mutateAsync(id).catch(() => {});
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockStore.clearData();
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
  });

  it("guest: archives and restores in the mock store", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    vi.mocked(useAuth).mockReturnValue({ isGuestMode: true } as any);
    const { id } = mockStore.addHabit({ name: "Read" } as any);
    const archivedAt = () =>
      mockStore.getHabits().find((h) => h.id === id)?.archived_at;

    await run(useArchiveHabit, id);
    expect(archivedAt()).toEqual(expect.any(String));
    await run(useUnarchiveHabit, id);
    expect(archivedAt()).toBeNull();
  });

  describe("signed in", () => {
    const setup = (result: { data: unknown; error: unknown }) => {
      vi.mocked(useAuth).mockReturnValue({ isGuestMode: false } as any);
      const update = vi.fn(() => ({
        eq: () => ({
          select: () => ({ single: () => Promise.resolve(result) }),
        }),
      }));
      vi.mocked(createClient).mockReturnValue({
        from: () => ({ update }),
      } as any);
      return update;
    };

    it.each([
      [
        "archive",
        useArchiveHabit,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      ],
      ["unarchive", useUnarchiveHabit, null],
    ])("%s writes the expected archived_at", async (_n, hook, value) => {
      const update = setup({ data: { id: "h1" }, error: null });
      await run(hook, "h1");
      expect(update).toHaveBeenCalledWith({ archived_at: value });
    });

    it("archive drops the habit from the active list, unarchive restores it in order", async () => {
      setup({ data: { id: "h1" }, error: null });
      const archived = habit("h1", "2026-01-01T00:00:00Z", 0);
      queryClient.setQueryData(key(true, false), [archived]);
      queryClient.setQueryData(key(false, false), [habit("h2", null, 1)]);
      // Skip the settle refetch so only the optimistic cache writes are asserted.
      const settled = vi
        .spyOn(queryClient, "invalidateQueries")
        .mockResolvedValue();

      await run(useUnarchiveHabit, "h1");
      expect(
        queryClient
          .getQueryData<HabitWithEntries[]>(key(false, false))
          ?.map((h) => h.id),
      ).toEqual(["h1", "h2"]);

      await run(useArchiveHabit, "h1");
      expect(
        queryClient
          .getQueryData<HabitWithEntries[]>(key(false, false))
          ?.map((h) => h.id),
      ).toEqual(["h2"]);
      settled.mockRestore();
    });

    it("rolls the caches back when the write fails", async () => {
      setup({ data: null, error: { message: "boom" } });
      const before = [habit("h1", null, 0)];
      queryClient.setQueryData(key(false, false), before);

      await run(useArchiveHabit, "h1");
      expect(queryClient.getQueryData(key(false, false))).toEqual(before);
    });
  });
});
