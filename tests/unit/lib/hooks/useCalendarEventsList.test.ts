import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCalendarEventsList } from "@/lib/hooks/useCalendarEventsList";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CalendarEvent } from "@/lib/types/calendar-event";

// Mock dependencies
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: { getEvents: vi.fn() },
}));

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    user_id: "u1",
    title: "Dentist",
    description: null,
    location: null,
    start_time: "2026-06-11T09:00:00.000Z",
    end_time: "2026-06-11T10:00:00.000Z",
    all_day: false,
    color: "hsl(var(--primary))",
    category: null,
    recurrence_rule: null,
    remote_id: null,
    remote_calendar_id: null,
    etag: null,
    ics_uid: null,
    sync_state: null,
    is_archived: false,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockRows(rows: CalendarEvent[]) {
  vi.mocked(useQuery).mockReturnValue({
    data: rows,
  } as unknown as UseQueryResult<unknown, unknown>);
}

/**
 * Test Perspective Table: useCalendarEventsList
 *
 * | Case ID | Input / Precondition | Perspective | Expected Result |
 * |---------|----------------------|-------------|-----------------|
 * | TC-N-01 | A dedicated event row | Equivalence - Normal | Maps to { id, title, date: start_time } |
 * | TC-A-01 | An archived event row | Boundary - Filter | Excluded from list output |
 * | TC-A-02 | No data yet (undefined) | Boundary - Empty | Returns [] |
 */

describe("useCalendarEventsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-N-01: maps a dedicated event row to { id, title, date }", () => {
    mockRows([
      makeEvent({
        id: "evt-1",
        title: "Dentist",
        start_time: "2026-06-11T09:00:00.000Z",
      }),
    ]);

    const { result } = renderHook(() => useCalendarEventsList());

    expect(result.current).toEqual([
      { id: "evt-1", title: "Dentist", date: "2026-06-11T09:00:00.000Z" },
    ]);
    // No tasks-as-events fields leak into the list output.
    expect(result.current[0]).not.toHaveProperty("content");
    expect(result.current[0]).not.toHaveProperty("category");
  });

  it("TC-A-01: excludes archived event rows", () => {
    mockRows([
      makeEvent({ id: "live", title: "Live", is_archived: false }),
      makeEvent({ id: "gone", title: "Gone", is_archived: true }),
    ]);

    const { result } = renderHook(() => useCalendarEventsList());

    expect(result.current.map((e) => e.id)).toEqual(["live"]);
  });

  it("TC-A-02: returns [] when there is no data", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { result } = renderHook(() => useCalendarEventsList());

    expect(result.current).toEqual([]);
  });
});
