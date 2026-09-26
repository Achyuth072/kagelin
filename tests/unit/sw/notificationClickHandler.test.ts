import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleNotificationClick,
  HABIT_ENTRY_UPDATED,
  type NotificationClickDeps,
  type HabitNotificationData,
} from "@/lib/sw/notificationClickHandler";

function makeDeps(
  overrides?: Partial<NotificationClickDeps>,
): NotificationClickDeps {
  const mockFetch = vi.fn();
  const mockPostMessage = vi.fn();
  const mockDisplayNotification = vi.fn().mockResolvedValue(undefined);
  const mockOpenWindow = vi.fn().mockResolvedValue(null);
  const mockFocus = vi.fn().mockResolvedValue(undefined);

  const mockClients = {
    matchAll: vi.fn().mockResolvedValue([
      {
        url: "http://localhost/habits",
        postMessage: mockPostMessage,
        focus: mockFocus,
      },
    ]),
  } as unknown as Clients;

  return {
    fetch: mockFetch,
    clients: mockClients,
    displayNotification: mockDisplayNotification,
    registration: {} as ServiceWorkerRegistration,
    openWindow: mockOpenWindow,
    ...overrides,
  };
}

const habitData: HabitNotificationData = {
  habitId: "habit-uuid-123",
  date: "2026-09-26",
  habitKind: "boolean",
  url: "/habits",
};

describe("handleNotificationClick — Done/Skip actions", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("posts the payload date (never the device clock) for Done", async () => {
    const deps = makeDeps();
    vi.mocked(deps.fetch).mockResolvedValue({ ok: true } as Response);

    await handleNotificationClick("done", habitData, "habit-tag", deps);

    expect(deps.fetch).toHaveBeenCalledWith(
      "/api/habits/entry",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          habitId: "habit-uuid-123",
          date: "2026-09-26",
          state: "done",
        }),
      }),
    );
  });

  it("posts skipped state for Skip", async () => {
    const deps = makeDeps();
    vi.mocked(deps.fetch).mockResolvedValue({ ok: true } as Response);

    await handleNotificationClick("skip", habitData, "habit-tag", deps);

    expect(deps.fetch).toHaveBeenCalledWith(
      "/api/habits/entry",
      expect.objectContaining({
        body: JSON.stringify({
          habitId: "habit-uuid-123",
          date: "2026-09-26",
          state: "skipped",
        }),
      }),
    );
  });

  it("messages all open windows on a successful POST", async () => {
    const deps = makeDeps();
    vi.mocked(deps.fetch).mockResolvedValue({ ok: true } as Response);

    await handleNotificationClick("done", habitData, "habit-tag", deps);

    expect(deps.clients.matchAll).toHaveBeenCalledWith({
      type: "window",
      includeUncontrolled: true,
    });
    const client = (
      await (deps.clients.matchAll as ReturnType<typeof vi.fn>).mock.results[0]
        .value
    )[0];
    expect(client.postMessage).toHaveBeenCalledWith({
      type: HABIT_ENTRY_UPDATED,
    });
  });

  it("shows a same-tag failure notification on network error", async () => {
    const deps = makeDeps();
    vi.mocked(deps.fetch).mockRejectedValue(new Error("offline"));

    await handleNotificationClick("done", habitData, "habit-tag", deps);

    expect(deps.displayNotification).toHaveBeenCalledWith(
      deps.registration,
      expect.any(String),
      expect.objectContaining({
        tag: "habit-tag",
        data: expect.objectContaining({ url: "/habits?habit=habit-uuid-123" }),
      }),
    );
  });

  it("shows a failure notification on a non-2xx response", async () => {
    const deps = makeDeps();
    vi.mocked(deps.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await handleNotificationClick("done", habitData, "habit-tag", deps);

    expect(deps.displayNotification).toHaveBeenCalledWith(
      deps.registration,
      expect.any(String),
      expect.objectContaining({ tag: "habit-tag" }),
    );
    expect(deps.clients.matchAll).not.toHaveBeenCalled();
  });
});

describe("handleNotificationClick — body tap", () => {
  it("focuses an open window already at the habit URL", async () => {
    const mockFocus = vi.fn().mockResolvedValue(undefined);
    const mockNavigate = vi.fn().mockResolvedValue(null);
    const deps = makeDeps({
      clients: {
        matchAll: vi.fn().mockResolvedValue([
          {
            url: "http://localhost/habits?habit=habit-uuid-123",
            focus: mockFocus,
            navigate: mockNavigate,
          },
        ]),
      } as unknown as Clients,
    });

    await handleNotificationClick("", habitData, undefined, deps);

    expect(mockFocus).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates an open window elsewhere to the habit", async () => {
    const mockFocus = vi.fn().mockResolvedValue(undefined);
    const mockNavigate = vi.fn().mockResolvedValue(null);
    const deps = makeDeps({
      clients: {
        matchAll: vi.fn().mockResolvedValue([
          {
            url: "http://localhost/habits",
            focus: mockFocus,
            navigate: mockNavigate,
          },
        ]),
      } as unknown as Clients,
    });

    await handleNotificationClick("", habitData, undefined, deps);

    expect(mockNavigate).toHaveBeenCalledWith("/habits?habit=habit-uuid-123");
    expect(mockFocus).toHaveBeenCalled();
  });

  it("opens a new window at the habit when no open client exists", async () => {
    const deps = makeDeps({
      clients: {
        matchAll: vi.fn().mockResolvedValue([]),
      } as unknown as Clients,
    });

    await handleNotificationClick("", habitData, undefined, deps);

    expect(deps.openWindow).toHaveBeenCalledWith(
      "/habits?habit=habit-uuid-123",
    );
  });

  it("uses the payload URL for notifications without a habit", async () => {
    const deps = makeDeps({
      clients: {
        matchAll: vi.fn().mockResolvedValue([]),
      } as unknown as Clients,
    });

    await handleNotificationClick("", { url: "/tasks" }, undefined, deps);

    expect(deps.openWindow).toHaveBeenCalledWith("/tasks");
  });
});
