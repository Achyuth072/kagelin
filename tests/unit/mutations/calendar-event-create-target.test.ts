import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

// ── Hoisted mock state ────────────────────────────────────────────────────────

const { bidiCalendarsRef, capturedInsert } = vi.hoisted(() => {
  const bidiCalendarsRef: { value: Array<{ id: string }> } = { value: [] };
  const capturedInsert: { value: Record<string, unknown> | null } = { value: null };
  return { bidiCalendarsRef, capturedInsert };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "user-1" } } } }),
    },
    from: (table: string) => {
      if (table === "external_calendars") {
        // Chainable query that resolves to the first bidirectional calendar
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: () =>
            Promise.resolve({ data: bidiCalendarsRef.value, error: null }),
        };
        return builder;
      }
      // calendar_events insert
      return {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: () => {
              capturedInsert.value = payload;
              return Promise.resolve({
                data: { id: payload.id, ...payload },
                error: null,
              });
            },
          }),
        }),
      };
    },
  }),
}));

function makeInput(overrides: Partial<CreateCalendarEventInput> = {}): CreateCalendarEventInput {
  return {
    title: "Standup",
    start_time: "2026-06-10T09:00:00Z",
    end_time: "2026-06-10T09:30:00Z",
    ...overrides,
  };
}

describe("calendarEventMutations.create — default sync target", () => {
  beforeEach(() => {
    bidiCalendarsRef.value = [];
    capturedInsert.value = null;
    localStorage.clear();
  });

  it("stamps remote_calendar_id + pending_create when a bidirectional calendar exists", async () => {
    bidiCalendarsRef.value = [{ id: "bidi-cal-1" }];
    const { calendarEventMutations } = await import("@/lib/mutations/calendar-event");

    await calendarEventMutations.create(makeInput());

    expect(capturedInsert.value).toMatchObject({
      remote_calendar_id: "bidi-cal-1",
      sync_state: "pending_create",
    });
  });

  it("leaves sync fields null when no bidirectional calendar is connected", async () => {
    bidiCalendarsRef.value = [];
    const { calendarEventMutations } = await import("@/lib/mutations/calendar-event");

    await calendarEventMutations.create(makeInput());

    expect(capturedInsert.value?.remote_calendar_id ?? null).toBeNull();
    expect(capturedInsert.value?.sync_state ?? null).toBeNull();
  });

  it("keeps a recurring authored event local-only (never queued for push)", async () => {
    bidiCalendarsRef.value = [{ id: "bidi-cal-1" }];
    const { calendarEventMutations } = await import("@/lib/mutations/calendar-event");

    await calendarEventMutations.create(
      makeInput({ recurrence_rule: "FREQ=WEEKLY;BYDAY=MO" }),
    );

    expect(capturedInsert.value?.remote_calendar_id ?? null).toBeNull();
    expect(capturedInsert.value?.sync_state ?? null).toBeNull();
  });
});
