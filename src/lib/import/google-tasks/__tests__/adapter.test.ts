import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGoogleTasksDataset } from "../adapter";

describe("fetchGoogleTasksDataset (Throttled Google Tasks API Transport)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches task lists and tasks with maxResults=100 and maps to GoogleTasksDataset", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/users/@me/lists")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "list-1",
                title: "My Tasks",
                updated: "2026-11-20T10:00:00Z",
              },
              { id: "list-2", title: "Work Projects" },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes("/lists/list-1/tasks")) {
        expect(urlStr).toContain("maxResults=100");
        expect(urlStr).toContain("showCompleted=true");
        expect(urlStr).toContain("showHidden=true");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "task-1",
                title: "Buy milk",
                notes: "2% organic",
                status: "needsAction",
                due: "2026-11-20T00:00:00.000Z",
                position: "00001",
              },
              {
                id: "task-deleted",
                title: "Old task",
                deleted: true,
              },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes("/lists/list-2/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "task-2",
                title: "Launch Phase 58",
                status: "completed",
                completed: "2026-11-20T12:00:00.000Z",
                position: "00002",
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const dataset = await fetchGoogleTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
    });

    expect(dataset.lists).toHaveLength(2);
    expect(dataset.lists[0]).toEqual({
      id: "list-1",
      title: "My Tasks",
      updated: "2026-11-20T10:00:00Z",
    });
    expect(dataset.lists[1]).toEqual({
      id: "list-2",
      title: "Work Projects",
    });

    // list-1 should have 1 task (deleted task excluded)
    expect(dataset.tasksByListId["list-1"]).toHaveLength(1);
    expect(dataset.tasksByListId["list-1"][0]).toEqual({
      id: "task-1",
      title: "Buy milk",
      notes: "2% organic",
      due: "2026-11-20T00:00:00.000Z",
      status: "needsAction",
      completed: undefined,
      parent: undefined,
      position: "00001",
      deleted: false,
      hidden: false,
    });

    expect(dataset.tasksByListId["list-2"]).toHaveLength(1);
    expect(dataset.tasksByListId["list-2"][0].status).toBe("completed");
    expect(dataset.tasksByListId["list-2"][0].completed).toBe(
      "2026-11-20T12:00:00.000Z",
    );
  });

  it("handles pagination with pageToken for both lists and tasks", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/users/@me/lists")) {
        if (!urlStr.includes("pageToken=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: "list-p1", title: "Page 1 List" }],
              nextPageToken: "list-token-page-2",
            }),
          } as Response;
        } else {
          expect(urlStr).toContain("pageToken=list-token-page-2");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: "list-p2", title: "Page 2 List" }],
            }),
          } as Response;
        }
      }
      if (urlStr.includes("/lists/list-p1/tasks")) {
        if (!urlStr.includes("pageToken=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: "t1", title: "Task 1", status: "needsAction" }],
              nextPageToken: "task-token-2",
            }),
          } as Response;
        } else {
          expect(urlStr).toContain("pageToken=task-token-2");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: "t2", title: "Task 2", status: "needsAction" }],
            }),
          } as Response;
        }
      }
      if (urlStr.includes("/lists/list-p2/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [],
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const dataset = await fetchGoogleTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
    });

    expect(dataset.lists).toHaveLength(2);
    expect(dataset.tasksByListId["list-p1"]).toHaveLength(2);
    expect(dataset.tasksByListId["list-p2"]).toHaveLength(0);
  });

  it("retries with exponential backoff on HTTP 429 and 503", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/users/@me/lists")) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Rate limit exceeded" } }),
          } as Response;
        }
        if (callCount === 2) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: "Service unavailable" } }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: "list-1", title: "Recovered List" }],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response;
    });

    const dataset = await fetchGoogleTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
      initialBackoffMs: 1, // fast test backoff
      maxRetries: 3,
    });

    expect(callCount).toBe(3);
    expect(dataset.lists).toHaveLength(1);
    expect(dataset.lists[0].title).toBe("Recovered List");
  });

  it("throws diagnostic error when exceeding max retries on HTTP 429", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: "Quota exceeded" } }),
        }) as unknown as Response,
    );

    await expect(
      fetchGoogleTasksDataset("mock-token", {
        fetchFn: fetchMock as unknown as typeof fetch,
        interRequestDelayMs: 0,
        initialBackoffMs: 1,
        maxRetries: 2,
      }),
    ).rejects.toThrow(/Rate limit exceeded \(HTTP 429\)/);
  });

  it("throws immediately on HTTP 401 Unauthorized without retrying", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid Credentials" } }),
      } as Response;
    });

    await expect(
      fetchGoogleTasksDataset("bad-token", {
        fetchFn: fetchMock as unknown as typeof fetch,
        interRequestDelayMs: 0,
        initialBackoffMs: 1,
        maxRetries: 3,
      }),
    ).rejects.toThrow(/HTTP 401/);

    expect(callCount).toBe(1);
  });

  it("throttles concurrent requests to maxConcurrency (max 2 concurrent connections)", async () => {
    let activeRequests = 0;
    let maxActiveSeen = 0;

    const listIds = Array.from({ length: 10 }, (_, i) => `list-${i}`);

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      activeRequests++;
      if (activeRequests > maxActiveSeen) {
        maxActiveSeen = activeRequests;
      }

      // Small async delay simulating network latency
      await new Promise((r) => setTimeout(r, 20));

      activeRequests--;

      if (urlStr.includes("/users/@me/lists")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: listIds.map((id) => ({ id, title: `Title ${id}` })),
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response;
    });

    await fetchGoogleTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
      maxConcurrency: 2,
    });

    expect(maxActiveSeen).toBeLessThanOrEqual(2);
  });
});
