import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMicrosoftTasksDataset } from "../adapter";

describe("fetchMicrosoftTasksDataset (Throttled Microsoft Graph API Transport)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches task lists and tasks and hydrates checklist items via batch requests", async () => {
    const fetchMock = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();

        if (urlStr.includes("/me/todo/lists") && !urlStr.includes("/tasks")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              value: [
                {
                  id: "list-1",
                  displayName: "Tasks",
                  wellknownListName: "defaultList",
                  isOwner: true,
                  isShared: false,
                },
                {
                  id: "list-2",
                  displayName: "Project X",
                  wellknownListName: "none",
                  isOwner: true,
                  isShared: true,
                },
              ],
            }),
          } as Response;
        }

        if (urlStr.includes("/lists/list-1/tasks")) {
          expect(urlStr).toContain("$top=100");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              value: [
                {
                  id: "task-1",
                  title: "Buy groceries",
                  body: { content: "Milk, bread", contentType: "text" },
                  importance: "high",
                  status: "notStarted",
                  dueDateTime: {
                    dateTime: "2026-11-21T00:00:00",
                    timeZone: "UTC",
                  },
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
              value: [
                {
                  id: "task-2",
                  title: "Deploy release",
                  body: { content: "<p>Ship it</p>", contentType: "html" },
                  importance: "normal",
                  status: "completed",
                  completedDateTime: {
                    dateTime: "2026-11-20T18:00:00",
                    timeZone: "UTC",
                  },
                },
              ],
            }),
          } as Response;
        }

        if (urlStr.includes("/$batch")) {
          expect(init?.method).toBe("POST");
          const body = JSON.parse(init?.body as string) as {
            requests: Array<{ id: string; url: string; method: string }>;
          };
          expect(body.requests.length).toBeGreaterThan(0);

          return {
            ok: true,
            status: 200,
            json: async () => ({
              responses: body.requests.map((req) => {
                if (req.url.includes("task-1")) {
                  return {
                    id: req.id,
                    status: 200,
                    body: {
                      value: [
                        {
                          id: "step-1-1",
                          displayName: "Organic whole milk",
                          isChecked: false,
                        },
                        {
                          id: "step-1-2",
                          displayName: "Sourdough bread",
                          isChecked: true,
                          checkedDateTime: "2026-11-21T10:00:00Z",
                        },
                      ],
                    },
                  };
                }
                return {
                  id: req.id,
                  status: 200,
                  body: { value: [] },
                };
              }),
            }),
          } as Response;
        }

        return { ok: false, status: 404 } as Response;
      },
    );

    const dataset = await fetchMicrosoftTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
    });

    expect(dataset.lists).toHaveLength(2);
    expect(dataset.lists[0].displayName).toBe("Tasks");
    expect(dataset.lists[0].wellknownListName).toBe("defaultList");
    expect(dataset.lists[1].displayName).toBe("Project X");
    expect(dataset.lists[1].wellknownListName).toBe("none");

    expect(dataset.tasksByListId["list-1"]).toHaveLength(1);
    const task1 = dataset.tasksByListId["list-1"][0];
    expect(task1.title).toBe("Buy groceries");
    expect(task1.importance).toBe("high");
    expect(task1.status).toBe("notStarted");
    expect(task1.checklistItems).toHaveLength(2);
    expect(task1.checklistItems[0].displayName).toBe("Organic whole milk");
    expect(task1.checklistItems[0].isChecked).toBe(false);
    expect(task1.checklistItems[1].displayName).toBe("Sourdough bread");
    expect(task1.checklistItems[1].isChecked).toBe(true);

    expect(dataset.tasksByListId["list-2"]).toHaveLength(1);
    const task2 = dataset.tasksByListId["list-2"][0];
    expect(task2.title).toBe("Deploy release");
    expect(task2.status).toBe("completed");
    expect(task2.checklistItems).toHaveLength(0);
  });

  it("handles pagination via @odata.nextLink for lists and tasks", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.includes("/me/todo/lists") && !urlStr.includes("/tasks")) {
        if (!urlStr.includes("skiptoken=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              "@odata.nextLink":
                "https://graph.microsoft.com/v1.0/me/todo/lists?skiptoken=page2",
              value: [{ id: "list-p1", displayName: "Page 1 List" }],
            }),
          } as Response;
        } else {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              value: [{ id: "list-p2", displayName: "Page 2 List" }],
            }),
          } as Response;
        }
      }

      if (urlStr.includes("/lists/list-p1/tasks")) {
        if (!urlStr.includes("skiptoken=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              "@odata.nextLink":
                "https://graph.microsoft.com/v1.0/me/todo/lists/list-p1/tasks?skiptoken=taskpage2",
              value: [{ id: "t1", title: "Task 1", status: "notStarted" }],
            }),
          } as Response;
        } else {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              value: [{ id: "t2", title: "Task 2", status: "notStarted" }],
            }),
          } as Response;
        }
      }

      if (urlStr.includes("/lists/list-p2/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            value: [{ id: "t3", title: "Task 3", status: "completed" }],
          }),
        } as Response;
      }

      if (urlStr.includes("/$batch")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responses: [
              { id: "1", status: 200, body: { value: [] } },
              { id: "2", status: 200, body: { value: [] } },
            ],
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const dataset = await fetchMicrosoftTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
    });

    expect(dataset.lists).toHaveLength(2);
    expect(dataset.tasksByListId["list-p1"]).toHaveLength(2);
    expect(dataset.tasksByListId["list-p2"]).toHaveLength(1);
  });

  it("retries with exponential backoff and respects Retry-After on HTTP 429", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/me/todo/lists") && !urlStr.includes("/tasks")) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "Retry-After": "1" }),
            json: async () => ({ error: { message: "Too many requests" } }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            value: [{ id: "list-1", displayName: "List 1" }],
          }),
        } as Response;
      }

      if (urlStr.includes("/lists/list-1/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            value: [{ id: "t1", title: "Task 1" }],
          }),
        } as Response;
      }

      if (urlStr.includes("/$batch")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responses: [{ id: "1", status: 200, body: { value: [] } }],
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const dataset = await fetchMicrosoftTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
      initialBackoffMs: 1,
      maxRetries: 3,
    });

    expect(callCount).toBe(2);
    expect(dataset.lists).toHaveLength(1);
    expect(dataset.lists[0].displayName).toBe("List 1");
  });

  it("handles HTTP-date string in Retry-After header per Spec L257", async () => {
    let callCount = 0;
    const futureDate = new Date(Date.now() + 10).toUTCString();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/me/todo/lists") && !urlStr.includes("/tasks")) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "Retry-After": futureDate }),
            json: async () => ({ error: { message: "Too many requests" } }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            value: [{ id: "list-1", displayName: "List 1" }],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ value: [] }),
      } as Response;
    });

    const dataset = await fetchMicrosoftTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
      initialBackoffMs: 1,
      maxRetries: 3,
    });

    expect(callCount).toBe(2);
    expect(dataset.lists).toHaveLength(1);
  });

  it("chunks batch checklist hydration requests into max 20 sub-requests per batch", async () => {
    const tasksCount = 45;
    const tasks = Array.from({ length: tasksCount }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Task ${i + 1}`,
      status: "notStarted",
    }));

    const batchRequestSizes: number[] = [];

    const fetchMock = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();

        if (urlStr.includes("/me/todo/lists") && !urlStr.includes("/tasks")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              value: [{ id: "list-big", displayName: "Big List" }],
            }),
          } as Response;
        }

        if (urlStr.includes("/lists/list-big/tasks")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ value: tasks }),
          } as Response;
        }

        if (urlStr.includes("/$batch")) {
          const body = JSON.parse(init?.body as string) as {
            requests: Array<{ id: string; url: string }>;
          };
          batchRequestSizes.push(body.requests.length);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              responses: body.requests.map((r) => ({
                id: r.id,
                status: 200,
                body: { value: [] },
              })),
            }),
          } as Response;
        }

        return { ok: false, status: 404 } as Response;
      },
    );

    const dataset = await fetchMicrosoftTasksDataset("mock-token", {
      fetchFn: fetchMock as unknown as typeof fetch,
      interRequestDelayMs: 0,
    });

    expect(dataset.tasksByListId["list-big"]).toHaveLength(45);
    // 45 tasks batched into chunks of max 20 => [20, 20, 5]
    expect(batchRequestSizes).toEqual([20, 20, 5]);
  });

  it("throws on non-retryable 401 Unauthorized without retrying", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid token" } }),
      } as unknown as Response;
    });

    await expect(
      fetchMicrosoftTasksDataset("bad-token", {
        fetchFn: fetchMock as unknown as typeof fetch,
        interRequestDelayMs: 0,
        maxRetries: 3,
      }),
    ).rejects.toThrow(/HTTP 401/);

    expect(callCount).toBe(1);
  });
});
