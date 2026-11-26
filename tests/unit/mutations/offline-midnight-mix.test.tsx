import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { useCreateTask, useUpdateTask } from "@/lib/hooks/useTaskMutations";
import {
  useCreateHabit,
  useUpdateHabit,
  useMarkHabitComplete,
} from "@/lib/hooks/useHabitMutations";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
} from "@/lib/hooks/useCalendarEventMutations";
import type { Task } from "@/lib/types/task";
import type { HabitWithEntries } from "@/lib/types/habit";
import type { CalendarEvent } from "@/lib/types/calendar-event";

// ── In-memory Supabase store ──────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

const { db } = vi.hoisted(() => ({
  db: {
    tasks: [] as Row[],
    habits: [] as Row[],
    habit_entries: [] as Row[],
    calendar_events: [] as Row[],
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "user-1" } }),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

vi.mock("@/lib/telemetry/store", () => ({
  markFirstAction: vi.fn(),
}));

vi.mock("@/lib/sync/sync-scheduler", () => ({
  notifyLocalEdit: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "user-1" } } } }),
    },
    from: (table: string) => {
      if (table === "external_calendars") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: () => Promise.resolve({ data: [], error: null }),
        };
        return builder;
      }

      const rows = (db as Record<string, Row[]>)[table];
      if (!rows) {
        throw new Error(`Unexpected table in test mock: ${table}`);
      }

      return {
        select: () => {
          let filtered = [...rows];
          const builder = {
            eq: (col: string, val: unknown) => {
              filtered = filtered.filter((r) => r[col] === val);
              return builder;
            },
            order: (col: string, opts?: { ascending?: boolean }) => {
              const asc = opts?.ascending ?? true;
              filtered.sort((a, b) => {
                const av = (a[col] as number) ?? 0;
                const bv = (b[col] as number) ?? 0;
                return asc ? av - bv : bv - av;
              });
              return builder;
            },
            limit: (n: number) => {
              filtered = filtered.slice(0, n);
              return builder;
            },
            maybeSingle: () =>
              Promise.resolve({ data: filtered[0] ?? null, error: null }),
            single: () => {
              if (!filtered[0]) {
                return Promise.resolve({
                  data: null,
                  error: { message: `No row found in ${table}` },
                });
              }
              return Promise.resolve({ data: filtered[0], error: null });
            },
          };
          return builder;
        },

        insert: (
          payload: Record<string, unknown> | Record<string, unknown>[],
        ) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted: Row[] = items.map((item) => ({
            ...item,
            id: (item.id as string) || crypto.randomUUID(),
            created_at: (item.created_at as string) || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          rows.push(...inserted);

          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
              then: (resolve: (res: { data: Row[]; error: null }) => void) =>
                resolve({ data: inserted, error: null }),
            }),
          };
        },

        update: (updates: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => ({
            select: () => ({
              single: () => {
                const idx = rows.findIndex((r) => r[col] === val);
                if (idx === -1) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: `Cannot update missing row ${String(val)} in ${table}`,
                    },
                  });
                }
                rows[idx] = {
                  ...rows[idx],
                  ...updates,
                  updated_at: new Date().toISOString(),
                };
                return Promise.resolve({ data: rows[idx], error: null });
              },
            }),
          }),
        }),

        upsert: (payload: Record<string, unknown>) => {
          const row: Row = {
            ...payload,
            id: (payload.id as string) || crypto.randomUUID(),
          };
          const existingIdx = rows.findIndex(
            (r) => r.habit_id === row.habit_id && r.date === row.date,
          );
          if (existingIdx >= 0) {
            rows[existingIdx] = { ...rows[existingIdx], ...row };
          } else {
            rows.push(row);
          }
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: existingIdx >= 0 ? rows[existingIdx] : row,
                  error: null,
                }),
            }),
          };
        },
      };
    },
  }),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        networkMode: "offlineFirst",
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("offline create + edit across midnight, then reconnect", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    db.tasks = [];
    db.habits = [];
    db.habit_entries = [];
    db.calendar_events = [];
    localStorage.clear();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 23:55 local time on 2026-11-26
    vi.setSystemTime(new Date(2026, 10, 26, 23, 55, 0));

    queryClient = createTestQueryClient();
    queryClient.setQueryData<Task[]>(["tasks", {}], []);
    queryClient.setQueryData<HabitWithEntries[]>(
      ["habits", { includeArchived: true }],
      [],
    );
    queryClient.setQueryData<CalendarEvent[]>(["calendar-events"], []);

    onlineManager.setOnline(false);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  it("tasks: preserves single item, offline edit, and intended due_date/do_date after midnight reconnect", async () => {
    const wrapper = makeWrapper(queryClient);
    const { result: createHook } = renderHook(() => useCreateTask(), {
      wrapper,
    });
    const { result: updateHook } = renderHook(() => useUpdateTask(), {
      wrapper,
    });

    await act(async () => {
      createHook.current.mutate({
        content: "Draft offline task",
        due_date: "2026-11-26",
        do_date: "2026-11-26",
      });
    });

    const optimisticTasks =
      queryClient.getQueryData<Task[]>(["tasks", {}]) ?? [];
    expect(optimisticTasks).toHaveLength(1);
    const taskId = optimisticTasks[0].id;

    await act(async () => {
      updateHook.current.mutate({
        id: taskId,
        content: "Edited offline task",
      });
    });

    // Cross midnight to 00:05 on 2026-11-27, then reconnect
    vi.setSystemTime(new Date(2026, 10, 27, 0, 5, 0));
    await act(async () => {
      onlineManager.setOnline(true);
      await queryClient.resumePausedMutations();
    });

    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0]).toMatchObject({
      content: "Edited offline task",
      due_date: "2026-11-26",
      do_date: "2026-11-26",
    });
  });

  it("habits: preserves single item, offline edit, and intended start_date/entry date after midnight reconnect", async () => {
    const wrapper = makeWrapper(queryClient);
    const { result: createHook } = renderHook(() => useCreateHabit(), {
      wrapper,
    });
    const { result: updateHook } = renderHook(() => useUpdateHabit(), {
      wrapper,
    });
    const { result: markHook } = renderHook(() => useMarkHabitComplete(), {
      wrapper,
    });

    await act(async () => {
      createHook.current.mutate({
        name: "Offline habit",
        start_date: "2026-11-26",
      });
    });

    const optimisticHabits =
      queryClient.getQueryData<HabitWithEntries[]>([
        "habits",
        { includeArchived: true },
      ]) ?? [];
    expect(optimisticHabits).toHaveLength(1);
    const habitId = optimisticHabits[0].id;

    await act(async () => {
      updateHook.current.mutate({
        id: habitId,
        name: "Edited offline habit",
      });
      markHook.current.mutate({
        habitId,
        date: "2026-11-26",
        value: 1,
      });
    });

    // Cross midnight to 00:05 on 2026-11-27, then reconnect
    vi.setSystemTime(new Date(2026, 10, 27, 0, 5, 0));
    await act(async () => {
      onlineManager.setOnline(true);
      await queryClient.resumePausedMutations();
    });

    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(db.habits).toHaveLength(1);
    expect(db.habits[0]).toMatchObject({
      name: "Edited offline habit",
      start_date: "2026-11-26",
    });
    expect(db.habit_entries).toHaveLength(1);
    expect(db.habit_entries[0]).toMatchObject({
      habit_id: db.habits[0].id,
      date: "2026-11-26",
    });
  });

  it("calendar events: preserves single item, offline edit, and intended start_time/end_time after midnight reconnect", async () => {
    const wrapper = makeWrapper(queryClient);
    const { result: createHook } = renderHook(() => useCreateCalendarEvent(), {
      wrapper,
    });
    const { result: updateHook } = renderHook(() => useUpdateCalendarEvent(), {
      wrapper,
    });

    const startTime = "2026-11-26T23:30:00";
    const endTime = "2026-11-26T23:50:00";

    await act(async () => {
      createHook.current.mutate({
        title: "Offline event",
        start_time: startTime,
        end_time: endTime,
        all_day: false,
      });
    });

    const optimisticEvents =
      queryClient.getQueryData<CalendarEvent[]>(["calendar-events"]) ?? [];
    expect(optimisticEvents).toHaveLength(1);
    const eventId = optimisticEvents[0].id;

    await act(async () => {
      updateHook.current.mutate({
        id: eventId,
        title: "Edited offline event",
      });
    });

    // Cross midnight to 00:05 on 2026-11-27, then reconnect
    vi.setSystemTime(new Date(2026, 10, 27, 0, 5, 0));
    await act(async () => {
      onlineManager.setOnline(true);
      await queryClient.resumePausedMutations();
    });

    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(db.calendar_events).toHaveLength(1);
    expect(db.calendar_events[0]).toMatchObject({
      title: "Edited offline event",
      start_time: startTime,
      end_time: endTime,
    });
  });

  it("habits: stamps local pre-midnight start_date when omitted offline and replayed after midnight", async () => {
    const wrapper = makeWrapper(queryClient);
    const { result: createHook } = renderHook(() => useCreateHabit(), {
      wrapper,
    });

    await act(async () => {
      createHook.current.mutate({
        name: "Late-night habit",
      });
    });

    vi.setSystemTime(new Date(2026, 10, 27, 0, 5, 0));
    await act(async () => {
      onlineManager.setOnline(true);
      await queryClient.resumePausedMutations();
    });

    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(db.habits).toHaveLength(1);
    expect(db.habits[0]).toMatchObject({
      name: "Late-night habit",
      start_date: "2026-11-26",
    });
  });
});
