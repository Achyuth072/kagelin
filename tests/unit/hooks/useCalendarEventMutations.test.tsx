import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "@/lib/hooks/useCalendarEventMutations";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import { useCalendarStore } from "@/lib/calendar/store";

vi.mock("@/lib/mutations/calendar-event", () => ({
  calendarEventMutations: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("@/lib/sync/sync-scheduler", () => ({
  notifyLocalEdit: vi.fn(),
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

import { calendarEventMutations } from "@/lib/mutations/calendar-event";

const mockMutations = vi.mocked(calendarEventMutations);

const makeEvent = (
  id: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id,
  user_id: "user-1",
  title: `Event ${id}`,
  description: null,
  location: null,
  start_time: "2026-10-01T10:00:00Z",
  end_time: "2026-10-01T11:00:00Z",
  all_day: false,
  color: "#4B6CB7",
  category: null,
  recurrence_rule: null,
  remote_id: null,
  remote_calendar_id: null,
  etag: null,
  ics_uid: null,
  sync_state: null,
  is_archived: false,
  metadata: {},
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...overrides,
});

describe("useCalendarEventMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    useCalendarStore.setState({ events: [] });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useCreateCalendarEvent", () => {
    it("adds event to both TanStack cache and Zustand store immediately", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("existing")],
      );
      mockMutations.create.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(makeEvent("server")), 50),
          ),
      );

      const { result } = renderHook(() => useCreateCalendarEvent(), {
        wrapper,
      });
      let mutatePromise: Promise<CalendarEvent>;
      act(() => {
        mutatePromise = result.current.mutateAsync({
          title: "New Event",
          start_time: "2026-10-01T10:00:00Z",
          end_time: "2026-10-01T11:00:00Z",
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<CalendarEvent[]>([
          "calendar-events",
          false,
        ]);
        expect(cached).toHaveLength(2);
        expect(useCalendarStore.getState().events).toHaveLength(1);
      });

      await act(() => mutatePromise!);
    });

    it("rolls back cache and store when creation fails", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("existing")],
      );
      useCalendarStore.setState({
        events: [
          {
            id: "existing",
            title: "Existing",
            start: new Date(),
            end: new Date(),
            allDay: false,
            color: "#4B6CB7",
          },
        ],
      });
      mockMutations.create.mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useCreateCalendarEvent(), {
        wrapper,
      });
      await act(async () => {
        await result.current.mutate({
          title: "Doomed Event",
          start_time: "2026-10-01T10:00:00Z",
          end_time: "2026-10-01T11:00:00Z",
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<CalendarEvent[]>([
          "calendar-events",
          false,
        ]);
        expect(cached).toHaveLength(1);
        expect(cached![0].id).toBe("existing");
        expect(useCalendarStore.getState().events).toHaveLength(1);
        expect(useCalendarStore.getState().events[0].id).toBe("existing");
      });
    });
  });

  describe("useUpdateCalendarEvent", () => {
    it("updates event in cache and store immediately", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("evt-1", { title: "Old" })],
      );
      mockMutations.update.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(makeEvent("evt-1", { title: "New" })), 50),
          ),
      );

      const { result } = renderHook(() => useUpdateCalendarEvent(), {
        wrapper,
      });
      let mutatePromise: Promise<CalendarEvent>;
      act(() => {
        mutatePromise = result.current.mutateAsync({
          id: "evt-1",
          title: "New",
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<CalendarEvent[]>([
          "calendar-events",
          false,
        ]);
        expect(cached?.find((e) => e.id === "evt-1")?.title).toBe("New");
      });

      await act(() => mutatePromise!);
    });

    it("rolls back cache when update fails", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("evt-1", { title: "Old" })],
      );
      mockMutations.update.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useUpdateCalendarEvent(), {
        wrapper,
      });
      await act(async () => {
        await result.current.mutate({ id: "evt-1", title: "Doomed" });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<CalendarEvent[]>([
          "calendar-events",
          false,
        ]);
        expect(cached![0].title).toBe("Old");
      });
    });
  });

  describe("useDeleteCalendarEvent", () => {
    it("removes event from cache and store immediately", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("evt-1")],
      );
      useCalendarStore.setState({
        events: [
          {
            id: "evt-1",
            title: "E1",
            start: new Date(),
            end: new Date(),
            allDay: false,
            color: "#4B6CB7",
          },
        ],
      });
      mockMutations.delete.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
      );

      const { result } = renderHook(() => useDeleteCalendarEvent(), {
        wrapper,
      });
      let mutatePromise: Promise<void>;
      act(() => {
        mutatePromise = result.current.mutateAsync("evt-1");
      });

      await waitFor(() => {
        expect(
          queryClient.getQueryData<CalendarEvent[]>(["calendar-events", false]),
        ).toHaveLength(0);
        expect(useCalendarStore.getState().events).toHaveLength(0);
      });

      await act(() => mutatePromise!);
    });

    it("rolls back when delete fails", async () => {
      queryClient.setQueryData(
        ["calendar-events", false],
        [makeEvent("evt-1")],
      );
      useCalendarStore.setState({
        events: [
          {
            id: "evt-1",
            title: "E1",
            start: new Date(),
            end: new Date(),
            allDay: false,
            color: "#4B6CB7",
          },
        ],
      });
      mockMutations.delete.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useDeleteCalendarEvent(), {
        wrapper,
      });
      await act(async () => {
        await result.current.mutate("evt-1");
      });

      await waitFor(() => {
        expect(
          queryClient.getQueryData<CalendarEvent[]>(["calendar-events", false]),
        ).toHaveLength(1);
        expect(useCalendarStore.getState().events).toHaveLength(1);
      });
    });
  });
});
