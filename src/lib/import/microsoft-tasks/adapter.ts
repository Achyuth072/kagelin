import {
  type MicrosoftTaskListResource,
  type MicrosoftTaskResource,
  type MicrosoftTasksDataset,
} from "./types";
import { chunkArray } from "./executor";

export interface FetchMicrosoftTasksOptions {
  /**
   * Microsoft Graph REST API base URL.
   * Defaults to "https://graph.microsoft.com/v1.0".
   */
  baseUrl?: string;

  /**
   * Minimum delay between outgoing request dispatches (ms).
   * Defaults to 250ms (enforces 4 QPS throttle ceiling).
   */
  interRequestDelayMs?: number;

  /**
   * Maximum concurrent HTTP requests.
   * Defaults to 2.
   */
  maxConcurrency?: number;

  /**
   * Maximum retry attempts on HTTP 429 or 503.
   * Defaults to 3.
   */
  maxRetries?: number;

  /**
   * Base backoff delay for exponential backoff (ms).
   * Defaults to 1000ms.
   */
  initialBackoffMs?: number;

  /**
   * Abort signal for request cancellation.
   */
  signal?: AbortSignal;

  /**
   * Custom fetch function (useful for mocking/testing).
   */
  fetchFn?: typeof fetch;

  /**
   * Optional flag to omit task lists that have zero tasks.
   * Defaults to false.
   */
  skipEmptyLists?: boolean;
}

const DEFAULT_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_INTER_REQUEST_DELAY_MS = 250;
const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Aborted"));
      },
      { once: true },
    );
  });
}

function resolveUrl(baseUrl: string, link: string): string {
  if (link.startsWith("http://") || link.startsWith("https://")) {
    return link;
  }
  const base = new URL(baseUrl);
  return new URL(link, base.origin).toString();
}

/**
 * Throttled request dispatcher enforcing concurrency limit and minimum inter-request delay.
 */
class ThrottledDispatcher {
  private activeCount = 0;
  private lastDispatchTime = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly interRequestDelayMs: number,
    private readonly signal?: AbortSignal,
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.signal?.aborted) {
      throw this.signal.reason ?? new Error("Aborted");
    }

    await new Promise<void>((resolve, reject) => {
      const run = () => resolve();
      if (this.signal?.aborted) {
        reject(this.signal.reason ?? new Error("Aborted"));
        return;
      }
      this.queue.push(run);
      this.pump();
    });

    try {
      return await task();
    } finally {
      this.activeCount--;
      this.pump();
    }
  }

  private pump() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.activeCount++;

    const now = Date.now();
    const elapsed = now - this.lastDispatchTime;
    const waitTime =
      this.interRequestDelayMs > 0 && elapsed < this.interRequestDelayMs
        ? this.interRequestDelayMs - elapsed
        : 0;

    if (waitTime > 0) {
      setTimeout(() => {
        this.lastDispatchTime = Date.now();
        next();
      }, waitTime);
    } else {
      this.lastDispatchTime = now;
      next();
    }
  }
}

/**
 * Executes a single HTTP request with exponential backoff on HTTP 429 and 503.
 */
async function fetchWithRetry(
  url: string,
  accessToken: string,
  options: {
    method?: "GET" | "POST";
    body?: string;
    fetchFn: typeof fetch;
    maxRetries: number;
    initialBackoffMs: number;
    signal?: AbortSignal;
  },
): Promise<unknown> {
  const {
    method = "GET",
    body,
    fetchFn,
    maxRetries,
    initialBackoffMs,
    signal,
  } = options;

  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetchFn(url, {
      method,
      headers,
      body,
      signal,
    });

    if (response.ok) {
      return await response.json();
    }

    const status = response.status;
    const isRetryable = status === 429 || status === 503;

    if (isRetryable && attempt < maxRetries) {
      let backoffMs = initialBackoffMs * Math.pow(2, attempt);

      const retryAfterHeader = response.headers?.get?.("Retry-After");
      if (retryAfterHeader) {
        const parsedSeconds = parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
          backoffMs = Math.max(backoffMs, parsedSeconds * 1000);
        }
      }

      attempt++;
      await sleep(backoffMs, signal);
      continue;
    }

    let errorDetail = "";
    try {
      const errData = (await response.json()) as {
        error?: { message?: string } | string;
      };
      if (typeof errData?.error === "object" && errData.error?.message) {
        errorDetail = errData.error.message;
      } else if (typeof errData?.error === "string") {
        errorDetail = errData.error;
      }
    } catch {
      // Body not JSON
    }

    if (status === 429) {
      throw new Error(
        `Rate limit exceeded (HTTP 429)${errorDetail ? `: ${errorDetail}` : ""}`,
      );
    }
    if (status === 503) {
      throw new Error(
        `Service unavailable (HTTP 503)${errorDetail ? `: ${errorDetail}` : ""}`,
      );
    }

    throw new Error(
      `Microsoft Graph API returned HTTP ${status}${errorDetail ? `: ${errorDetail}` : ""}`,
    );
  }
}

/**
 * Fetches all Microsoft To Do task lists, tasks, and checklist items,
 * throttled at <= 4 QPS with max 2 concurrent connections and exponential backoff.
 */
export async function fetchMicrosoftTasksDataset(
  accessToken: string,
  options: FetchMicrosoftTasksOptions = {},
): Promise<MicrosoftTasksDataset> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const interRequestDelayMs =
    options.interRequestDelayMs ?? DEFAULT_INTER_REQUEST_DELAY_MS;
  const maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialBackoffMs =
    options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const signal = options.signal;
  const skipEmptyLists = options.skipEmptyLists ?? false;

  const dispatcher = new ThrottledDispatcher(
    maxConcurrency,
    interRequestDelayMs,
    signal,
  );

  const executeGet = (url: string) =>
    dispatcher.schedule(() =>
      fetchWithRetry(url, accessToken, {
        method: "GET",
        fetchFn,
        maxRetries,
        initialBackoffMs,
        signal,
      }),
    );

  const executePost = (url: string, body: string) =>
    dispatcher.schedule(() =>
      fetchWithRetry(url, accessToken, {
        method: "POST",
        body,
        fetchFn,
        maxRetries,
        initialBackoffMs,
        signal,
      }),
    );

  // 1. Fetch all task lists (traversing @odata.nextLink)
  const lists: MicrosoftTaskListResource[] = [];
  let nextListUrl: string | undefined = `${baseUrl}/me/todo/lists`;

  while (nextListUrl) {
    const data = (await executeGet(nextListUrl)) as {
      value?: Array<{
        id?: string;
        displayName?: string;
        isOwner?: boolean;
        isShared?: boolean;
        wellknownListName?: string;
      }>;
      "@odata.nextLink"?: string;
    };

    const rawItems = Array.isArray(data?.value) ? data.value : [];
    for (const item of rawItems) {
      if (!item || !item.id) continue;
      const listId = item.id.trim();
      const displayName =
        typeof item.displayName === "string" && item.displayName.trim()
          ? item.displayName.trim()
          : "Untitled List";

      let wellknown: "none" | "defaultList" | "flaggedEmails" | "unknown" =
        "none";
      if (item.wellknownListName === "defaultList") {
        wellknown = "defaultList";
      } else if (item.wellknownListName === "flaggedEmails") {
        wellknown = "flaggedEmails";
      } else if (item.wellknownListName && item.wellknownListName !== "none") {
        wellknown = "unknown";
      }

      lists.push({
        id: listId,
        displayName,
        isOwner: item.isOwner !== false,
        isShared: item.isShared === true,
        wellknownListName: wellknown,
        tasks: [],
      });
    }

    nextListUrl = data?.["@odata.nextLink"]
      ? resolveUrl(baseUrl, data["@odata.nextLink"])
      : undefined;
  }

  // 2. Fetch tasks per list (traversing @odata.nextLink)
  const tasksByListId: Record<string, MicrosoftTaskResource[]> = {};

  const fetchTasksForList = async (listId: string) => {
    const tasks: MicrosoftTaskResource[] = [];
    let nextTaskUrl: string | undefined =
      `${baseUrl}/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=100`;

    while (nextTaskUrl) {
      const data = (await executeGet(nextTaskUrl)) as {
        value?: Array<{
          id?: string;
          title?: string;
          body?: { content?: string; contentType?: "text" | "html" };
          importance?: string;
          status?: string;
          isReminderOn?: boolean;
          createdDateTime?: string;
          lastModifiedDateTime?: string;
          completedDateTime?: { dateTime: string; timeZone?: string };
          dueDateTime?: { dateTime: string; timeZone?: string };
          checklistItems?: Array<{
            id: string;
            displayName: string;
            isChecked?: boolean;
            createdDateTime?: string;
            checkedDateTime?: string | null;
          }>;
        }>;
        "@odata.nextLink"?: string;
      };

      const rawTasks = Array.isArray(data?.value) ? data.value : [];
      for (const item of rawTasks) {
        if (!item || typeof item !== "object") continue;

        const taskId =
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : crypto.randomUUID();

        const title =
          typeof item.title === "string" ? item.title : "Untitled Task";

        const importance: "low" | "normal" | "high" =
          item.importance === "high"
            ? "high"
            : item.importance === "low"
              ? "low"
              : "normal";

        const validStatuses = [
          "notStarted",
          "inProgress",
          "completed",
          "waitingOnOthers",
          "deferred",
        ] as const;
        const status = validStatuses.includes(
          item.status as (typeof validStatuses)[number],
        )
          ? (item.status as (typeof validStatuses)[number])
          : "notStarted";

        tasks.push({
          id: taskId,
          title,
          body: item.body
            ? {
                content: item.body.content ?? "",
                contentType: item.body.contentType === "html" ? "html" : "text",
              }
            : undefined,
          importance,
          status,
          isReminderOn: item.isReminderOn === true,
          createdDateTime: item.createdDateTime,
          lastModifiedDateTime: item.lastModifiedDateTime,
          completedDateTime: item.completedDateTime
            ? {
                dateTime: item.completedDateTime.dateTime,
                timeZone: item.completedDateTime.timeZone ?? "UTC",
              }
            : undefined,
          dueDateTime: item.dueDateTime
            ? {
                dateTime: item.dueDateTime.dateTime,
                timeZone: item.dueDateTime.timeZone ?? "UTC",
              }
            : undefined,
          checklistItems: Array.isArray(item.checklistItems)
            ? item.checklistItems.map((step) => ({
                id: step.id,
                displayName: step.displayName,
                isChecked: step.isChecked === true,
                createdDateTime: step.createdDateTime,
                checkedDateTime: step.checkedDateTime,
              }))
            : [],
        });
      }

      nextTaskUrl = data?.["@odata.nextLink"]
        ? resolveUrl(baseUrl, data["@odata.nextLink"])
        : undefined;
    }

    return { listId, tasks };
  };

  const taskResults = await Promise.all(
    lists.map((list) => fetchTasksForList(list.id)),
  );

  for (const res of taskResults) {
    tasksByListId[res.listId] = res.tasks;
  }

  // 3. Hydrate checklist items via $batch (up to 20 sub-requests per batch)
  for (const list of lists) {
    const listTasks = tasksByListId[list.id] ?? [];
    const tasksNeedingChecklist = listTasks.filter(
      (task) => !task.checklistItems || task.checklistItems.length === 0,
    );

    if (tasksNeedingChecklist.length === 0) continue;

    const batches = chunkArray(tasksNeedingChecklist, 20);
    for (const batch of batches) {
      const requests = batch.map((task, idx) => ({
        id: String(idx + 1),
        method: "GET",
        url: `/me/todo/lists/${encodeURIComponent(list.id)}/tasks/${encodeURIComponent(task.id)}/checklistItems`,
      }));

      const batchPayload = JSON.stringify({ requests });
      const batchResult = (await executePost(
        `${baseUrl}/$batch`,
        batchPayload,
      )) as {
        responses?: Array<{
          id: string;
          status: number;
          body?: {
            value?: Array<{
              id: string;
              displayName: string;
              isChecked?: boolean;
              createdDateTime?: string;
              checkedDateTime?: string | null;
            }>;
          };
        }>;
      };

      if (Array.isArray(batchResult?.responses)) {
        for (const resp of batchResult.responses) {
          const idx = parseInt(resp.id, 10) - 1;
          const task = batch[idx];
          if (task && resp.status === 200 && Array.isArray(resp.body?.value)) {
            task.checklistItems = resp.body.value.map((item) => ({
              id: item.id || crypto.randomUUID(),
              displayName: item.displayName || "",
              isChecked: item.isChecked === true,
              createdDateTime: item.createdDateTime,
              checkedDateTime: item.checkedDateTime,
            }));
          }
        }
      }
    }
  }

  const finalLists: MicrosoftTaskListResource[] = [];
  for (const list of lists) {
    const listTasks = tasksByListId[list.id] ?? [];
    if (skipEmptyLists && listTasks.length === 0) {
      continue;
    }
    list.tasks = listTasks;
    finalLists.push(list);
  }

  return {
    lists: finalLists,
    tasksByListId,
  };
}
