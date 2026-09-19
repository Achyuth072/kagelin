/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { mockStore } from "@/lib/mock/mock-store";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import * as uhabitsModule from "@/lib/import/uhabits";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    loading: vi.fn(() => "loading-toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

vi.mock("@/lib/mutations/importSource", () => ({
  persistImportSource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const mockCreateClient = vi.mocked(createClient);

describe("useUhabitsImport hook", () => {
  let queryClient: QueryClient;

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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("imports full-fidelity habits and entries with notes into mockStore in guest mode", async () => {
    localStorage.setItem("kanso_guest_mode", "true");

    const mockHabit: Habit = {
      id: "temp-habit-1",
      user_id: "",
      name: "Read",
      description: "Reading habit",
      color: "#4B6CB7",
      icon: "Book",
      created_at: "2026-09-03T00:00:00.000Z",
      updated_at: "2026-09-03T00:00:00.000Z",
      archived_at: "2026-09-03T12:00:00.000Z",
      start_date: "2026-08-01",
      sort_order: 0,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 10,
      unit: "pages",
      question: "How many pages did you read?",
      reminder_time: "08:30",
      reminder_days: 127,
    };

    const mockEntries: HabitEntry[] = [
      {
        id: "temp-entry-1",
        habit_id: "temp-habit-1",
        date: "2026-08-01",
        value: 10,
        notes: "Read chapter 1",
        created_at: "2026-09-03T00:00:00.000Z",
      },
      {
        id: "temp-entry-2",
        habit_id: "temp-habit-1",
        date: "2026-08-02",
        value: -2,
        notes: "Rest day",
        created_at: "2026-09-03T00:00:00.000Z",
      },
    ];

    vi.spyOn(uhabitsModule, "parseUhabitsFile").mockResolvedValueOnce({
      habits: [mockHabit],
      entries: mockEntries,
      source: { habits: [], repetitions: [] },
    });

    const file = new File(["fixture content"], "test.db");
    const { result } = renderHook(() => useUhabitsImport(), { wrapper });

    await act(async () => {
      await result.current.importUhabits(file);
    });

    const storedHabits = mockStore.getHabits();
    expect(storedHabits).toHaveLength(1);
    const createdHabit = storedHabits[0];
    expect(createdHabit.name).toBe("Read");
    expect(createdHabit.archived_at).toBe("2026-09-03T12:00:00.000Z");
    expect(createdHabit.habit_type).toBe("measurable");
    expect(createdHabit.target_value).toBe(10);
    expect(createdHabit.unit).toBe("pages");
    expect(createdHabit.question).toBe("How many pages did you read?");
    expect(createdHabit.reminder_time).toBe("08:30");
    expect(createdHabit.reminder_days).toBe(127);

    const storedEntries = mockStore.getHabitEntries();
    expect(storedEntries).toHaveLength(2);
    expect(storedEntries[0].habit_id).toBe(createdHabit.id);
    expect(storedEntries[0].value).toBe(10);
    expect(storedEntries[0].notes).toBe("Read chapter 1");
    expect(storedEntries[1].habit_id).toBe(createdHabit.id);
    expect(storedEntries[1].value).toBe(-2);
    expect(storedEntries[1].notes).toBe("Rest day");
  });

  it("inserts full-fidelity habits and entries with notes into Supabase in authenticated mode", async () => {
    localStorage.setItem("kanso_guest_mode", "false");

    const mockHabit: Habit = {
      id: "temp-habit-1",
      user_id: "",
      name: "Workout",
      description: "Exercise",
      color: "#4B6CB7",
      icon: "Dumbbell",
      created_at: "2026-09-03T00:00:00.000Z",
      updated_at: "2026-09-03T00:00:00.000Z",
      archived_at: null,
      start_date: "2026-08-01",
      sort_order: 0,
      habit_type: "boolean",
      target_type: null,
      target_value: null,
      unit: null,
      question: "Did you exercise?",
      reminder_time: "07:00",
      reminder_days: 127,
    };

    const mockEntries: HabitEntry[] = [
      {
        id: "temp-entry-1",
        habit_id: "temp-habit-1",
        date: "2026-08-01",
        value: 1,
        notes: "Good workout",
        created_at: "2026-09-03T00:00:00.000Z",
      },
    ];

    vi.spyOn(uhabitsModule, "parseUhabitsFile").mockResolvedValueOnce({
      habits: [mockHabit],
      entries: mockEntries,
      source: { habits: [], repetitions: [] },
    });

    const mockUser = { id: "user-abc" };
    const insertedHabit = {
      ...mockHabit,
      id: "db-habit-id-123",
      user_id: "user-abc",
    };

    const insertedEntries: any[] = [];
    const insertedHabits: any[] = [];

    mockCreateClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "habits") {
          return {
            select: vi.fn().mockReturnValue({
              then: (resolve: any) => resolve({ data: [], error: null }),
            }),
            insert: vi.fn((data: any) => {
              insertedHabits.push(data);
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: insertedHabit,
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === "habit_entries") {
          return {
            insert: vi.fn((data: any) => {
              insertedEntries.push(...data);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {} as any;
      }),
    } as any);

    const file = new File(["fixture content"], "test.db");
    const { result } = renderHook(() => useUhabitsImport(), { wrapper });

    await act(async () => {
      await result.current.importUhabits(file);
    });

    expect(insertedHabits).toHaveLength(1);
    expect(insertedHabits[0].name).toBe("Workout");
    expect(insertedHabits[0].question).toBe("Did you exercise?");
    expect(insertedHabits[0].reminder_time).toBe("07:00");
    expect(insertedHabits[0].reminder_days).toBe(127);

    expect(insertedEntries).toHaveLength(1);
    expect(insertedEntries[0].habit_id).toBe("db-habit-id-123");
    expect(insertedEntries[0].value).toBe(1);
    expect(insertedEntries[0].notes).toBe("Good workout");
  });
});
