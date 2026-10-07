/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useMarkHabitComplete,
} from "@/lib/hooks/useHabitMutations";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { trackTelemetry } from "@/lib/telemetry/client";
import { mockStore } from "@/lib/mock/mock-store";

const mockCreateClient = vi.mocked(createClient);
const mockUseAuth = vi.mocked(useAuth);

describe("useHabitMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  describe("useCreateHabit", () => {
    describe("TC-N-01: Create habit with valid data", () => {
      it("should create habit and invalidate queries", async () => {
        const mockUser = { id: "user-1" };
        const newHabit = {
          id: "habit-1",
          user_id: "user-1",
          name: "Morning Workout",
          description: "Daily exercise",
          color: "#10b981",
          icon: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          archived_at: null,
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockInsert = vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: newHabit, error: null }),
          })),
        }));
        // create reads the current max sort_order before inserting (append).
        const mockMaxSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: { sort_order: 2 }, error: null }),
              })),
            })),
          })),
        }));

        mockCreateClient.mockReturnValue({
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: { user: mockUser } },
              error: null,
            }),
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: mockUser }, error: null }),
          },
          from: vi.fn(() => ({
            select: mockMaxSelect,
            insert: mockInsert,
          })),
        } as any);

        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useCreateHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync({
            name: "Morning Workout",
            description: "Daily exercise",
            color: "#10b981",
          });
        });

        expect(mockInsert).toHaveBeenCalledWith({
          id: expect.any(String),
          user_id: "user-1",
          name: "Morning Workout",
          description: "Daily exercise",
          color: "#10b981",
          icon: null,
          archived_at: null,
          start_date: expect.any(String),
          sort_order: 3,
          habit_type: "boolean",
          frequency_count: null,
          frequency_days: 1,
          frequency_period: "day",
          target_type: null,
          target_value: null,
          unit: null,
          question: null,
          reminder_time: null,
          reminder_days: 127,
          source_uuid: null,
        });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] });
      });
    });

    describe("TC-N-05: Guest mode - create habit", () => {
      it("should create habit successfully in guest mode", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: true } as any);
        localStorage.setItem("kanso_guest_mode", "true");

        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useCreateHabit(), { wrapper });

        let createdHabit: any;
        await act(async () => {
          createdHabit = await result.current.mutateAsync({
            name: "Guest Habit",
            description: "A habit for guest",
          });
        });

        expect(createdHabit).toBeDefined();
        expect(createdHabit.name).toBe("Guest Habit");
        expect(createdHabit.id).toContain("guest-habit");
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] });
      });
    });

    describe("TC-OPT-01: useCreateHabit optimistic cache update", () => {
      const mockSupabaseInsert = (opts: {
        data?: unknown;
        error?: unknown;
        delayMs?: number;
      }) => {
        const run = () =>
          opts.delayMs
            ? new Promise((r) =>
                setTimeout(
                  () => r({ data: opts.data, error: opts.error ?? null }),
                  opts.delayMs,
                ),
              )
            : Promise.resolve({ data: opts.data, error: opts.error ?? null });

        mockCreateClient.mockReturnValue({
          auth: {
            getSession: () =>
              Promise.resolve({
                data: { session: { user: { id: "user-1" } } },
              }),
            getUser: () =>
              Promise.resolve({
                data: { user: { id: "user-1" } },
                error: null,
              }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                order: () => ({ limit: () => ({ maybeSingle: () => run() }) }),
              }),
            }),
            insert: () => ({ select: () => ({ single: () => run() }) }),
          }),
        } as any);
      };

      it("adds the new habit to the cache immediately before mutationFn resolves", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          [
            {
              id: "habit-existing",
              name: "Existing",
              entries: [],
              sort_order: 0,
            },
          ],
        );

        mockSupabaseInsert({
          data: {
            id: "habit-server",
            name: "New Habit",
            entries: [],
            sort_order: 1,
            archived_at: null,
          },
          delayMs: 50,
        });

        const { result } = renderHook(() => useCreateHabit(), { wrapper });
        let mutatePromise: Promise<any>;
        act(() => {
          mutatePromise = result.current.mutateAsync({ name: "New Habit" });
        });

        await waitFor(() => {
          const cached: any = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cached).toHaveLength(2);
          expect(cached.some((h: any) => h.name === "New Habit")).toBe(true);
        });

        await act(() => mutatePromise!);
      });

      it("rolls back the cache if create fails", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          [
            {
              id: "habit-existing",
              name: "Existing",
              entries: [],
              sort_order: 0,
            },
          ],
        );

        mockSupabaseInsert({ error: { message: "DB error" } });

        const { result } = renderHook(() => useCreateHabit(), { wrapper });
        await act(async () => {
          try {
            await result.current.mutateAsync({ name: "Doomed Habit" });
          } catch (_) {}
        });

        await waitFor(() => {
          const cached: any = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cached).toHaveLength(1);
          expect(cached[0].id).toBe("habit-existing");
        });
      });
    });
  });

  describe("useUpdateHabit", () => {
    describe("TC-N-02: Update habit metadata", () => {
      it("should update habit successfully", async () => {
        const updatedHabit = {
          id: "habit-1",
          name: "Updated Name",
          description: "Updated description",
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockUpdate = vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi
                .fn()
                .mockResolvedValue({ data: updatedHabit, error: null }),
            })),
          })),
        }));

        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            update: mockUpdate,
          })),
        } as any);

        const { result } = renderHook(() => useUpdateHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync({
            id: "habit-1",
            name: "Updated Name",
            description: "Updated description",
          });
        });

        expect(mockUpdate).toHaveBeenCalledWith({
          name: "Updated Name",
          description: "Updated description",
        });
      });
    });

    describe("TC-OPT-02: useUpdateHabit optimistic cache update", () => {
      const mockSupabaseUpdate = (opts: {
        data?: unknown;
        error?: unknown;
        delayMs?: number;
      }) => {
        const run = () =>
          opts.delayMs
            ? new Promise((r) =>
                setTimeout(
                  () => r({ data: opts.data, error: opts.error ?? null }),
                  opts.delayMs,
                ),
              )
            : Promise.resolve({ data: opts.data, error: opts.error ?? null });

        mockCreateClient.mockReturnValue({
          from: () => ({
            update: () => ({
              eq: () => ({ select: () => ({ single: () => run() }) }),
            }),
          }),
        } as any);
      };

      it("updates the habit in the cache immediately before mutationFn resolves", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          [
            {
              id: "habit-1",
              name: "Old Name",
              description: "Old desc",
              entries: [],
              sort_order: 0,
            },
          ],
        );

        mockSupabaseUpdate({
          data: { id: "habit-1", name: "New Name", description: "New desc" },
          delayMs: 50,
        });

        const { result } = renderHook(() => useUpdateHabit(), { wrapper });
        let mutatePromise: Promise<any>;
        act(() => {
          mutatePromise = result.current.mutateAsync({
            id: "habit-1",
            name: "New Name",
            description: "New desc",
          });
        });

        await waitFor(() => {
          const cached: any = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cached?.[0]?.name).toBe("New Name");
        });

        await act(() => mutatePromise!);
      });

      it("rolls back the cache when update fails", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          [{ id: "habit-1", name: "Old Name", entries: [], sort_order: 0 }],
        );

        mockSupabaseUpdate({ error: { message: "fail" } });

        const { result } = renderHook(() => useUpdateHabit(), { wrapper });
        await act(async () => {
          try {
            await result.current.mutateAsync({
              id: "habit-1",
              name: "Doomed Name",
            });
          } catch (_) {}
        });

        await waitFor(() => {
          const cached: any = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cached?.[0]?.name).toBe("Old Name");
        });
      });
    });
  });

  describe("useDeleteHabit", () => {
    describe("TC-N-03: Delete habit with optimistic update", () => {
      it("should remove from cache and delete from DB", async () => {
        const existingHabits = [
          { id: "habit-1", name: "Habit 1", entries: [] },
          { id: "habit-2", name: "Habit 2", entries: [] },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockDelete = vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }));

        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            delete: mockDelete,
          })),
        } as any);

        const { result } = renderHook(() => useDeleteHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync("habit-1");
        });

        const cacheData = queryClient.getQueryData([
          "habits",
          { includeArchived: false, isGuestMode: false },
        ]);
        expect(cacheData).toHaveLength(1);
        expect(mockDelete).toHaveBeenCalled();
      });
    });

    describe("TC-E-02: Delete with rollback on error", () => {
      it("should revert cache on error", async () => {
        const existingHabits = [
          { id: "habit-1", name: "Habit 1", entries: [] },
          { id: "habit-2", name: "Habit 2", entries: [] },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            delete: vi.fn(() => ({
              eq: vi
                .fn()
                .mockResolvedValue({ error: { message: "Delete failed" } }),
            })),
          })),
        } as any);

        const { result } = renderHook(() => useDeleteHabit(), { wrapper });

        await act(async () => {
          try {
            await result.current.mutateAsync("habit-1");
          } catch (e) {}
        });

        await waitFor(() => {
          const cacheData = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cacheData).toEqual(existingHabits);
        });
      });
    });
  });

  describe("useMarkHabitComplete", () => {
    describe("TC-N-04: Mark habit complete with optimistic update", () => {
      it("should upsert entry and update cache optimistically", async () => {
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            entries: [
              {
                id: "entry-1",
                habit_id: "habit-1",
                date: "2024-01-14",
                value: 1,
                created_at: "2024-01-14T10:00:00Z",
              },
            ],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        const newEntry = {
          id: "entry-2",
          habit_id: "habit-1",
          date: "2024-01-15",
          value: 1,
          created_at: "2024-01-15T10:00:00Z",
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            }),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: newEntry, error: null }),
              })),
            })),
          })),
        } as any);

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: "habit-1",
            date: "2024-01-15",
            value: 1,
          });
        });

        const cacheData: any = queryClient.getQueryData([
          "habits",
          { includeArchived: false, isGuestMode: false },
        ]);
        expect(cacheData[0].entries).toHaveLength(2);
      });
    });

    describe("TC-E-03: Mark complete with rollback on error", () => {
      it("should revert cache on upsert error", async () => {
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            entries: [],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            }),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Upsert failed" },
                }),
              })),
            })),
          })),
        } as any);

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({
              habitId: "habit-1",
              date: "2024-01-15",
              value: 1,
            });
          } catch (e) {}
        });

        await waitFor(() => {
          const cacheData = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cacheData).toEqual(existingHabits);
        });
      });
    });

    describe("clearing a day (value: null)", () => {
      it("deletes the cloud entry, drops it from the cache, and skips telemetry", async () => {
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          [
            {
              id: "habit-1",
              name: "Habit 1",
              entries: [
                {
                  id: "entry-1",
                  habit_id: "habit-1",
                  date: "2024-01-15",
                  value: 1,
                  created_at: "2024-01-15T10:00:00Z",
                },
              ],
            },
          ],
        );

        const eqDate = vi.fn().mockResolvedValue({ error: null });
        const eqHabit = vi.fn(() => ({ eq: eqDate }));
        const del = vi.fn(() => ({ eq: eqHabit }));
        const upsert = vi.fn();
        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({ delete: del, upsert })),
        } as any);

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: "habit-1",
            date: "2024-01-15",
            value: null,
          });
        });

        expect(del).toHaveBeenCalled();
        expect(eqHabit).toHaveBeenCalledWith("habit_id", "habit-1");
        expect(eqDate).toHaveBeenCalledWith("date", "2024-01-15");
        expect(upsert).not.toHaveBeenCalled();
        const cacheData: any = queryClient.getQueryData([
          "habits",
          { includeArchived: false, isGuestMode: false },
        ]);
        expect(cacheData[0].entries).toHaveLength(0);
        expect(trackTelemetry).not.toHaveBeenCalled();
      });
    });

    describe("habit_logged telemetry", () => {
      it("fires habit_logged telemetry when a habit is completed", async () => {
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            habit_type: "boolean",
            frequency_period: "day",
            frequency_count: 1,
            target_type: "at_least",
            target_value: 1,
            entries: [],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            }),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { habit_id: "habit-1", date: "2024-01-15", value: 1 },
                  error: null,
                }),
              })),
            })),
          })),
        } as any);

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: "habit-1",
            date: "2024-01-15",
            value: 1,
          });
        });

        expect(trackTelemetry).toHaveBeenCalledWith("habit_logged", {});
      });

      it("does not fire habit_logged when value is 0 (unmarked)", async () => {
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            entries: [],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            }),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { habit_id: "habit-1", date: "2024-01-15", value: 0 },
                  error: null,
                }),
              })),
            })),
          })),
        } as any);

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: "habit-1",
            date: "2024-01-15",
            value: 0,
          });
        });

        expect(trackTelemetry).not.toHaveBeenCalled();
      });
    });

    describe("guest demo-data telemetry exemption", () => {
      beforeEach(() => {
        localStorage.setItem("kanso_guest_mode", "true");
      });

      it("does not fire habit_logged when completing a seeded demo habit", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: true } as any);
        mockStore.reset();
        const seedHabitId = mockStore.getHabits()[0].id;

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: seedHabitId,
            date: "2024-01-15",
            value: 1,
          });
        });

        expect(trackTelemetry).not.toHaveBeenCalled();
      });

      it("still fires habit_logged for a habit the guest created themselves", async () => {
        mockUseAuth.mockReturnValue({ isGuestMode: true } as any);
        mockStore.reset();
        const ownHabit = mockStore.addHabit({
          name: "My own habit",
          description: null,
          color: "#000000",
          icon: null,
          archived_at: null,
          start_date: "2024-01-01",
          habit_type: "boolean",
          frequency_count: 1,
          frequency_period: "day",
          target_type: "at_least",
          target_value: null,
          unit: null,
        });

        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: ownHabit.id,
            date: "2024-01-15",
            value: 1,
          });
        });

        expect(trackTelemetry).toHaveBeenCalledWith("habit_logged", {});
      });
    });
  });
});
