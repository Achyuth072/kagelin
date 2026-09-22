import { describe, expect, it } from "vitest";
import { REDACTED, scrubBreadcrumb, scrubEvent } from "@/lib/errors/scrubEvent";
import { sentryOptions } from "../../../../sentry.shared";

const TASK_TITLE = "Buy milk for Nana";

function eventCarryingContent() {
  return {
    event_id: "abc",
    platform: "javascript",
    release: "kagelin@1.2.3",
    message: `Failed to save "${TASK_TITLE}"`,
    exception: {
      values: [
        {
          type: "TypeError",
          value: `Cannot read properties of undefined (title: "${TASK_TITLE}")`,
          stacktrace: {
            frames: [
              {
                filename: "src/lib/mutations/useTasks.ts",
                function: "saveTask",
                lineno: 42,
                vars: { title: TASK_TITLE },
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      {
        category: "xhr",
        type: "http",
        level: "info",
        message: `PATCH /rest/v1/tasks?title=eq.${TASK_TITLE}`,
        data: {
          method: "PATCH",
          status_code: 400,
          url: `https://x.supabase.co/rest/v1/tasks?title=eq.${TASK_TITLE}`,
          body: { title: TASK_TITLE },
        },
      },
    ],
    request: {
      url: `https://kagelin.app/tasks?q=${TASK_TITLE}`,
      method: "POST",
      headers: { Cookie: "sb-access-token=secret" },
      data: { title: TASK_TITLE },
    },
    extra: { task: { title: TASK_TITLE } },
    contexts: {
      os: { name: "iOS" },
      state: { state: { tasks: [{ title: TASK_TITLE }] } },
    },
    user: { id: "user-1", email: "someone@example.com" },
    tags: { route: "tasks" },
  };
}

describe("scrubEvent", () => {
  it("removes user content from every part of the payload", () => {
    const scrubbed = scrubEvent(eventCarryingContent());

    expect(JSON.stringify(scrubbed)).not.toContain(TASK_TITLE);
  });

  it.each([
    "Failed to fetch",
    "Load failed",
    "No service worker registered",
    "Service worker registration timeout",
  ])("keeps the content-free message %j", (message) => {
    const event = eventCarryingContent();
    event.exception.values[0].value = message;

    expect(scrubEvent(event).exception.values[0].value).toBe(message);
  });

  it("redacts a message that only looks like a safe one", () => {
    const event = eventCarryingContent();
    event.exception.values[0].value = `Failed to fetch task "${TASK_TITLE}"`;

    expect(scrubEvent(event).exception.values[0].value).toBe("[redacted]");
  });

  it("retains what diagnosis needs", () => {
    const scrubbed = scrubEvent(eventCarryingContent());

    expect(scrubbed.release).toBe("kagelin@1.2.3");
    expect(scrubbed.platform).toBe("javascript");
    expect(scrubbed.exception.values[0].type).toBe("TypeError");
    expect(scrubbed.exception.values[0].stacktrace.frames[0]).toMatchObject({
      filename: "src/lib/mutations/useTasks.ts",
      function: "saveTask",
      lineno: 42,
    });
    expect(scrubbed.breadcrumbs[0]).toMatchObject({
      category: "xhr",
      type: "http",
      level: "info",
    });
    expect(scrubbed.breadcrumbs[0].data).toEqual({
      method: "PATCH",
      status_code: 400,
      url: "https://x.supabase.co/rest/v1/tasks",
    });
    expect(scrubbed.tags).toEqual({ route: "tasks" });
    expect(scrubbed.message).toBe(REDACTED);
  });

  it("drops the request body, headers and everything under extra", () => {
    const scrubbed = scrubEvent(eventCarryingContent());

    expect(scrubbed.request).toEqual({
      url: "https://kagelin.app/tasks",
      method: "POST",
    });
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.contexts.state).toBeUndefined();
    expect(scrubbed.contexts.os).toEqual({ name: "iOS" });
    expect(scrubbed.user).toEqual({ id: "user-1" });
  });

  it("keeps span timings while stripping query strings from descriptions", () => {
    const transaction = {
      type: "transaction",
      spans: [
        {
          op: "http.client",
          description: `GET /rest/v1/tasks?title=eq.${TASK_TITLE}`,
          start_timestamp: 1,
          timestamp: 2,
          data: { method: "GET", "db.statement": TASK_TITLE },
        },
      ],
    };

    const scrubbed = scrubEvent(transaction);

    expect(JSON.stringify(scrubbed)).not.toContain(TASK_TITLE);
    expect(scrubbed.spans[0]).toMatchObject({
      op: "http.client",
      description: "GET /rest/v1/tasks",
      start_timestamp: 1,
      timestamp: 2,
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("keeps the breadcrumb name and drops its message and unknown data", () => {
    const scrubbed = scrubBreadcrumb({
      category: "ui.click",
      message: `button[aria-label="${TASK_TITLE}"]`,
      data: { note: TASK_TITLE },
    });

    expect(scrubbed).toEqual({ category: "ui.click", message: REDACTED });
  });
});

describe("sentryOptions", () => {
  it("scrubs on the way out in every runtime", () => {
    expect(sentryOptions.beforeSend).toBe(scrubEvent);
    expect(sentryOptions.beforeSendTransaction).toBe(scrubEvent);
    expect(sentryOptions.beforeBreadcrumb).toBe(scrubBreadcrumb);
    expect(sentryOptions.sendDefaultPii).toBe(false);
  });

  it("does not leak content through the configured beforeSend hook", () => {
    const sent = sentryOptions.beforeSend(eventCarryingContent());

    expect(JSON.stringify(sent)).not.toContain(TASK_TITLE);
  });
});

describe("WebAssembly diagnostics survive scrubbing", () => {
  it("keeps the compile error from a wasm binary that is not wasm", () => {
    const event = {
      exception: {
        values: [
          {
            type: "CompileError",
            value:
              "WebAssembly.instantiate(): expected magic word 00 61 73 6d, found 3c 21 44 4f @+0",
          },
        ],
      },
    };
    expect(scrubEvent(event).exception.values[0].value).toBe(
      "WebAssembly.instantiate(): expected magic word 00 61 73 6d, found 3c 21 44 4f @+0",
    );
  });

  it("keeps the sql.js abort wrapper around a compile error", () => {
    const event = {
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Aborted(CompileError: WebAssembly.instantiate(): expected 4 bytes, fell off end @+0)",
          },
        ],
      },
    };
    expect(scrubEvent(event).exception.values[0].value).toContain("Aborted(");
  });

  it("keeps wasm console breadcrumbs", () => {
    const crumb = {
      category: "console",
      message: "wasm streaming compile failed: TypeError",
    };
    expect(scrubBreadcrumb(crumb).message).toBe(
      "wasm streaming compile failed: TypeError",
    );
  });

  it("still redacts console breadcrumbs carrying user content", () => {
    const crumb = { category: "console", message: `Saved "${TASK_TITLE}"` };
    expect(scrubBreadcrumb(crumb).message).toBe(REDACTED);
  });

  it("still redacts an unrelated exception value", () => {
    const event = {
      exception: {
        values: [{ type: "TypeError", value: `Cannot read "${TASK_TITLE}"` }],
      },
    };
    expect(scrubEvent(event).exception.values[0].value).toBe(REDACTED);
  });
});
