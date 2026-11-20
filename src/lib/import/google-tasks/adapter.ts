import {
  type GoogleTaskListResource,
  type GoogleTaskResource,
  type GoogleTasksDataset,
} from "./types";

export interface FetchGoogleTasksOptions {
  /**
   * Google Tasks REST API base URL.
   * Defaults to "https://tasks.googleapis.com/tasks/v1".
   */
  baseUrl?: string;

  /**
   * Minimum delay between outgoing request dispatches (ms).
   * Defaults to 200ms (enforces 4 QPS throttle ceiling).
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
   * Defaults to 1000ms (1s, 2s, 4s).
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

const DEFAULT_BASE_URL = "https://tasks.googleapis.com/tasks/v1";
const DEFAULT_INTER_REQUEST_DELAY_MS = 200;
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
    fetchFn: typeof fetch;
    maxRetries: number;
    initialBackoffMs: number;
    signal?: AbortSignal;
  },
): Promise<unknown> {
  const { fetchFn, maxRetries, initialBackoffMs, signal } = options;

  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal,
    });

    if (response.ok) {
      return await response.json();
    }

    const status = response.status;
    const isRetryable = status === 429 || status === 503;

    if (isRetryable && attempt < maxRetries) {
      // Calculate exponential backoff: initialBackoffMs * 2^attempt
      let backoffMs = initialBackoffMs * Math.pow(2, attempt);

      // Check Retry-After header if available
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

    // Parse error description
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
      `Google Tasks API returned HTTP ${status}${errorDetail ? `: ${errorDetail}` : ""}`,
    );
  }
}

/**
 * Fetches all Google Task Lists and Tasks for the authenticated user,
 * throttled at 4 QPS with max 2 concurrent connections and exponential backoff.
 */
export async function fetchGoogleTasksDataset(
  accessToken: string,
  options: FetchGoogleTasksOptions = {},
): Promise<GoogleTasksDataset> {
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
        fetchFn,
        maxRetries,
        initialBackoffMs,
        signal,
      }),
    );

  // 1. Fetch all task lists (paginated with maxResults=100)
  const lists: GoogleTaskListResource[] = [];
  let listPageToken: string | undefined;

  do {
    const listUrl = new URL(`${baseUrl}/users/@me/lists`);
    listUrl.searchParams.set("maxResults", "100");
    if (listPageToken) {
      listUrl.searchParams.set("pageToken", listPageToken);
    }

    const data = (await executeGet(listUrl.toString())) as {
      items?: Array<{ id?: string; title?: string; updated?: string }>;
      nextPageToken?: string;
    };

    const rawItems = Array.isArray(data?.items) ? data.items : [];
    for (const item of rawItems) {
      if (!item || !item.id) continue;
      const rawId = item.id.trim();
      const rawTitle = typeof item.title === "string" ? item.title.trim() : "";

      const isDefault = rawId === "@default" || rawTitle === "@default";
      const listId = isDefault ? "@default" : rawId;
      let title = rawTitle;
      if (isDefault) {
        title = !title || title === "@default" ? "Inbox" : title;
      } else if (!title) {
        title = "Untitled List";
      }

      lists.push({
        id: listId,
        title,
        updated: typeof item.updated === "string" ? item.updated : undefined,
      });
    }

    listPageToken = data?.nextPageToken || undefined;
  } while (listPageToken);

  // 2. Fetch tasks for each list concurrently (capped at maxConcurrency)
  const tasksByListId: Record<string, GoogleTaskResource[]> = {};

  const fetchTasksForList = async (listId: string) => {
    const tasks: GoogleTaskResource[] = [];
    let taskPageToken: string | undefined;

    do {
      const taskUrl = new URL(
        `${baseUrl}/lists/${encodeURIComponent(listId)}/tasks`,
      );
      taskUrl.searchParams.set("maxResults", "100");
      taskUrl.searchParams.set("showCompleted", "true");
      taskUrl.searchParams.set("showHidden", "true");
      if (taskPageToken) {
        taskUrl.searchParams.set("pageToken", taskPageToken);
      }

      const data = (await executeGet(taskUrl.toString())) as {
        items?: Array<{
          id?: string;
          title?: string;
          notes?: string;
          due?: string;
          status?: string;
          completed?: string;
          parent?: string;
          position?: string;
          deleted?: boolean;
          hidden?: boolean;
        }>;
        nextPageToken?: string;
      };

      const rawTasks = Array.isArray(data?.items) ? data.items : [];
      for (const item of rawTasks) {
        if (!item || typeof item !== "object") continue;

        // Filter out tombstones / deleted items
        if (item.deleted === true) {
          continue;
        }

        const taskId =
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : crypto.randomUUID();

        tasks.push({
          id: taskId,
          title: typeof item.title === "string" ? item.title : "",
          notes: typeof item.notes === "string" ? item.notes : undefined,
          due: typeof item.due === "string" ? item.due : undefined,
          status: item.status === "completed" ? "completed" : "needsAction",
          completed:
            typeof item.completed === "string" ? item.completed : undefined,
          parent:
            typeof item.parent === "string" && item.parent.trim()
              ? item.parent.trim()
              : undefined,
          position:
            typeof item.position === "string" ? item.position : undefined,
          deleted: false,
          hidden: item.hidden === true,
        });
      }

      taskPageToken = data?.nextPageToken || undefined;
    } while (taskPageToken);

    return { listId, tasks };
  };

  const results = await Promise.all(
    lists.map((list) => fetchTasksForList(list.id)),
  );

  const finalLists: GoogleTaskListResource[] = [];
  for (const result of results) {
    if (skipEmptyLists && result.tasks.length === 0) {
      continue;
    }
    const matchingList = lists.find((l) => l.id === result.listId);
    if (matchingList) {
      finalLists.push(matchingList);
    }
    tasksByListId[result.listId] = result.tasks;
  }

  return {
    lists: finalLists,
    tasksByListId,
  };
}
