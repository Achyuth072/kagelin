"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { calendarEventMutations } from "@/lib/mutations/calendar-event";
import { useCalendarStore } from "@/lib/calendar/store";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { applyReadableUpdate } from "@/lib/crypto/unreadable";
import { toCalendarEventUI } from "@/lib/types/calendar-event";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarEvent,
  CalendarEventUI,
} from "@/lib/types/calendar-event";

type CalendarEventsSnapshot = [
  readonly unknown[],
  CalendarEvent[] | undefined,
][];

interface CalendarMutationContext {
  snapshot: CalendarEventsSnapshot;
  previousStoreEvents: CalendarEventUI[];
  tempId?: string;
}

async function prepareCalendarSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<CalendarMutationContext> {
  await queryClient.cancelQueries({ queryKey: ["calendar-events"] });
  return {
    snapshot: queryClient.getQueriesData<CalendarEvent[]>({
      queryKey: ["calendar-events"],
    }),
    previousStoreEvents: useCalendarStore.getState().events,
  };
}

function restoreCalendarSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  context?: CalendarMutationContext,
  err?: unknown,
) {
  context?.snapshot.forEach(([key, data]) =>
    queryClient.setQueryData(key, data),
  );
  if (context?.previousStoreEvents) {
    useCalendarStore.setState({ events: context.previousStoreEvents });
  }
  if (err) handleMutationError(err);
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationFn: (input: CreateCalendarEventInput) =>
      calendarEventMutations.create(input),
    onMutate: async (input: CreateCalendarEventInput) => {
      const context = await prepareCalendarSnapshot(queryClient);
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();

      const optimisticEvent: CalendarEvent = {
        id: tempId,
        user_id: isGuestMode ? "guest" : "",
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day ?? false,
        color: input.color ?? "#4B6CB7",
        category: input.category ?? null,
        recurrence_rule: input.recurrence_rule ?? null,
        remote_id: null,
        remote_calendar_id: null,
        etag: null,
        ics_uid: input.ics_uid ?? null,
        sync_state: null,
        is_archived: false,
        reminder_minutes: input.reminder_minutes ?? null,
        metadata: input.metadata ?? {},
        created_at: now,
        updated_at: now,
      };

      context.snapshot.forEach(([key, data]) => {
        queryClient.setQueryData<CalendarEvent[]>(key, [
          ...(data ?? []),
          optimisticEvent,
        ]);
      });
      useCalendarStore.getState().addEvent(toCalendarEventUI(optimisticEvent));

      return { ...context, tempId };
    },
    onSuccess: (data: CalendarEvent, _input, context) => {
      if (context?.tempId && data.id !== context.tempId) {
        context.snapshot.forEach(([key]) => {
          queryClient.setQueryData<CalendarEvent[]>(key, (old) =>
            old?.map((e) => (e.id === context.tempId ? data : e)),
          );
        });
        useCalendarStore
          .getState()
          .updateEvent(context.tempId, toCalendarEventUI(data));
      }
      notifyLocalEdit();
    },
    onError: (err, _input, context) =>
      restoreCalendarSnapshot(queryClient, context, err),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCalendarEventInput) =>
      calendarEventMutations.update(input),
    onMutate: async (input: UpdateCalendarEventInput) => {
      const context = await prepareCalendarSnapshot(queryClient);
      const { id, ...updates } = input;

      context.snapshot.forEach(([key]) => {
        queryClient.setQueryData<CalendarEvent[]>(key, (old) =>
          old?.map((e) => (e.id === id ? applyReadableUpdate(e, updates) : e)),
        );
      });
      useCalendarStore
        .getState()
        .updateEvent(id, updates as Partial<CalendarEventUI>);

      return context;
    },
    onSuccess: (data: CalendarEvent) => {
      useCalendarStore.getState().updateEvent(data.id, toCalendarEventUI(data));
      notifyLocalEdit();
    },
    onError: (err, _input, context) =>
      restoreCalendarSnapshot(queryClient, context, err),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calendarEventMutations.delete(id),
    onMutate: async (id: string) => {
      const context = await prepareCalendarSnapshot(queryClient);

      context.snapshot.forEach(([key]) => {
        queryClient.setQueryData<CalendarEvent[]>(key, (old) =>
          old?.filter((e) => e.id !== id),
        );
      });
      useCalendarStore.getState().deleteEvent(id);

      return context;
    },
    onSuccess: () => notifyLocalEdit(),
    onError: (err, _id, context) =>
      restoreCalendarSnapshot(queryClient, context, err),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
